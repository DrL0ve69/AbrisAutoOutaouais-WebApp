using AbrisAutoOutaouais_WebApp.Application.Planning.Commands.OptimizeRoute;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Domain.Entities;
using Domain.ValueObjects;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Planning;

/// <summary>
/// Endpoint d'optimisation de tournée (US-11.3) — vraie pile HTTP + JWT réel + DB InMemory.
///  • POST /api/v1/planning/optimize : écriture <c>AdminOnly</c> (403 Staff, 200 Admin) ;
///  • le recalage RÉÉCRIT effectivement les heures sur la grille de créneaux.
/// [Collection("Integration")] obligatoire — host/DB partagés (L-010).
/// </summary>
[Collection("Integration")]
public sealed class OptimizeRouteEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public OptimizeRouteEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    /// <summary>Une journée future (jour ouvré) : les créneaux de grille restent futurs.</summary>
    private static DateOnly FutureWeekday(int addDays)
    {
        var day = DateTime.UtcNow.Date.AddDays(addDays);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return DateOnly.FromDateTime(day);
    }

    private async Task<(Guid UserId, string Token)> RegisterAndLoginAsync(string? role = null)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"opt-{suffix}@test.com";
        const string password = "Test1234!";

        var register = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username = $"u{suffix}"[..16],
            password,
            confirmPassword = password,
            firstName = "Test",
            lastName = "Employé",
        });
        register.EnsureSuccessStatusCode();
        var registered = await register.Content.ReadFromJsonAsync<JsonElement>();
        var userId = registered.GetProperty("userId").GetGuid();

        if (role is not null)
        {
            using var scope = _factory.Services.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var user = await userManager.FindByIdAsync(userId.ToString());
            await userManager.AddToRoleAsync(user!, role);
        }

        var login = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        return (userId, body.GetProperty("token").GetString()!);
    }

    /// <summary>Seede directement un BookingSlot à un jour/heure donnés, avec coordonnées.</summary>
    private async Task<Guid> SeedBookingAsync(
        Guid customerId, DateOnly day, int hourUtc, double? lat, double? lng)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var address = Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X 1A1");
        var booking = BookingSlot.Create(
            customerId, DateTime.UtcNow.AddDays(60), 120, BookingType.Installation, address,
            lat: lat, lng: lng);
        typeof(BookingSlot).GetProperty(nameof(BookingSlot.SlotStart))!
            .SetValue(booking, day.ToDateTime(new TimeOnly(hourUtc, 0), DateTimeKind.Utc));

        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync();
        return booking.Id;
    }

    private async Task<DateTime> ReadSlotStartAsync(Guid bookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = await db.BookingSlots.AsNoTracking().FirstAsync(b => b.Id == bookingId);
        return booking.SlotStart;
    }

    [Fact]
    public async Task Optimize_AsStaff_Returns403()
    {
        var (_, staffToken) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(staffToken);

        var response = await _client.PostAsync(
            $"/api/v1/planning/optimize?date={FutureWeekday(70):yyyy-MM-dd}", content: null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Optimize_Anonymous_Returns401()
    {
        var response = await _client.PostAsync(
            $"/api/v1/planning/optimize?date={FutureWeekday(71):yyyy-MM-dd}", content: null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Optimize_AsAdmin_ReschedulesBookingsOntoGrid()
    {
        var (customerId, _) = await RegisterAndLoginAsync();
        var day = FutureWeekday(72);

        // Deux RDV géolocalisés (l'un loin, l'un proche de la base) + un sans coordonnées (exclu).
        // L'exclu est posé à 12:00 (créneau de grille aligné) : il GÈLE ce créneau, donc les recalés
        // ne peuvent pas l'écraser (anti-double-réservation, Finding 1) — ils prennent 08:00 puis 10:00,
        // libres. Le créneau 12:00 gelé sera sauté si un 3e RDV recalable existait.
        var farId = await SeedBookingAsync(customerId, day, 15, 46.0, -74.5);
        var nearId = await SeedBookingAsync(customerId, day, 9, 45.49, -75.71);
        var noCoordsId = await SeedBookingAsync(customerId, day, 12, null, null);

        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.PostAsync(
            $"/api/v1/planning/optimize?date={day:yyyy-MM-dd}", content: null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<OptimizeRouteResultDto>();
        result.Should().NotBeNull();

        // Les deux RDV géolocalisés sont ordonnés (proche d'abord) et recalés ; le 3e est exclu.
        result!.Stops.Should().HaveCount(2);
        result.Stops[0].BookingId.Should().Be(nearId);
        result.Stops[1].BookingId.Should().Be(farId);
        result.Stops.Should().OnlyContain(s => s.Rescheduled);
        result.ExcludedBookingIds.Should().ContainSingle().Which.Should().Be(noCoordsId);

        // Réécriture EFFECTIVE en base : 08:00 UTC et 10:00 UTC.
        (await ReadSlotStartAsync(nearId)).Should()
            .Be(day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc));
        (await ReadSlotStartAsync(farId)).Should()
            .Be(day.ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc));
        // L'exclu garde son heure d'origine (12:00 UTC) — non recalé.
        (await ReadSlotStartAsync(noCoordsId)).Should()
            .Be(day.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc));

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
