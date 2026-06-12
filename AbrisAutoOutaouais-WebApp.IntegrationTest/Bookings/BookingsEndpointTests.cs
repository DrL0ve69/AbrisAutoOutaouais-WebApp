using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Domain.Entities;
using Domain.ValueObjects;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Bookings;

/// <summary>
/// Tests de bout en bout du report d'une réservation : POST /api/v1/bookings/{id}/reschedule.
/// Vraie pile HTTP + JWT réel + DB InMemory. Couvre la propriété (404), la double-réservation
/// (422), le créneau invalide (422) et l'auth (401). Chaque test utilise une semaine distincte
/// pour éviter les collisions de créneaux dans la DB partagée par la collection.
/// </summary>
[Collection("Integration")]
public sealed class BookingsEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public BookingsEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Début de créneau futur, jour ouvré, aligné sur la grille (08/10/12/14 h UTC).</summary>
    private static DateTime Slot(int addDays, int hourUtc)
    {
        var day = DateTime.UtcNow.Date.AddDays(addDays);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return new DateTime(day.Year, day.Month, day.Day, hourUtc, 0, 0, DateTimeKind.Utc);
    }

    private async Task<(Guid UserId, string Token)> RegisterAndLoginAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"book-{suffix}@test.com";
        const string password = "Test1234!";

        var register = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username = $"u{suffix}"[..16],
            password,
            confirmPassword = password,
            firstName = "Test",
            lastName = "Client",
        });
        register.EnsureSuccessStatusCode();

        var login = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        return (body.GetProperty("userId").GetGuid(), body.GetProperty("token").GetString()!);
    }

    private async Task<Guid> SeedBookingAsync(Guid customerId, DateTime slotStart)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var booking = BookingSlot.Create(customerId, slotStart, 120, BookingType.Installation,
            Address.Create("123 rue des Érables", "Gatineau", "QC", "J8X1A1"));
        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync();
        return booking.Id;
    }

    private async Task<DateTime> GetSlotStartAsync(Guid bookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = await db.BookingSlots.AsNoTracking().FirstAsync(b => b.Id == bookingId);
        return booking.SlotStart;
    }

    private Task<HttpResponseMessage> RescheduleAsync(Guid id, DateTime newSlotStart)
        => _client.PostAsJsonAsync($"/api/v1/bookings/{id}/reschedule", new { newSlotStart });

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Reschedule_Owner_ToFreeSlot_Returns204AndMoves()
    {
        var (userId, token) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(7, 10));
        var target = Slot(7, 12); // même jour, créneau libre et valide
        _client.SetBearerToken(token);

        var response = await RescheduleAsync(bookingId, target);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await GetSlotStartAsync(bookingId)).Should().Be(target);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Reschedule_ToSlotTakenByAnotherBooking_Returns422()
    {
        var (userId, token) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(14, 10));
        await SeedBookingAsync(userId, Slot(14, 12)); // occupe le créneau cible
        _client.SetBearerToken(token);

        var response = await RescheduleAsync(bookingId, Slot(14, 12));

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Reschedule_ToInvalidGridSlot_Returns422()
    {
        var (userId, token) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(21, 10));
        _client.SetBearerToken(token);

        var response = await RescheduleAsync(bookingId, Slot(21, 9)); // 09 h : hors grille de 2 h

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Reschedule_NonOwner_Returns404AndLeavesSlotUnchanged()
    {
        var (ownerId, _) = await RegisterAndLoginAsync();
        var original = Slot(28, 10);
        var bookingId = await SeedBookingAsync(ownerId, original);
        var (_, strangerToken) = await RegisterAndLoginAsync();
        _client.SetBearerToken(strangerToken);

        var response = await RescheduleAsync(bookingId, Slot(28, 12));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await GetSlotStartAsync(bookingId)).Should().Be(original);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Reschedule_Anonymous_Returns401()
    {
        var response = await RescheduleAsync(Guid.NewGuid(), Slot(35, 10));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AvailableSlots_OnAWeekday_ReturnsSlots()
    {
        // Garde-fou du refactor SlotRules : la génération de créneaux reste fonctionnelle.
        var day = Slot(60, 10).Date;
        var from = DateOnly.FromDateTime(day);

        var response = await _client.GetAsync(
            $"/api/v1/bookings/available-slots?from={from:yyyy-MM-dd}&to={from:yyyy-MM-dd}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var slots = await response.Content.ReadFromJsonAsync<JsonElement>();
        slots.GetArrayLength().Should().BeGreaterThan(0);
    }
}
