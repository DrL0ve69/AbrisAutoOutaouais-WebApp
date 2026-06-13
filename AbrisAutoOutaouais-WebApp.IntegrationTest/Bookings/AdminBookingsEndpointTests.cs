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
/// Endpoints d'administration des réservations : GET /api/v1/bookings/all et
/// POST /api/v1/bookings/{id}/status. Vraie pile HTTP + JWT réel + DB InMemory.
/// Couvre l'autorisation (401 anonyme, 403 Customer, 200 Admin), les transitions
/// légales (204) et illégales (422), l'action inconnue/vide (422) et l'id inconnu (404).
/// </summary>
[Collection("Integration")]
public sealed class AdminBookingsEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public AdminBookingsEndpointTests(WebAppFactory factory)
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

    private async Task<(Guid UserId, string Token, string Email)> RegisterAndLoginAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"adminb-{suffix}@test.com";
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
        return (body.GetProperty("userId").GetGuid(), body.GetProperty("token").GetString()!, email);
    }

    /// <summary>Sème une réservation au statut voulu (les transitions passent par l'agrégat).</summary>
    private async Task<Guid> SeedBookingAsync(Guid customerId, DateTime slotStart, BookingStatus status = BookingStatus.Pending)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var booking = BookingSlot.Create(customerId, slotStart, 120, BookingType.Installation,
            Address.Create("123 rue des Érables", "Gatineau", "QC", "J8X1A1"));
        switch (status)
        {
            case BookingStatus.Confirmed:
                booking.Confirm();
                break;
            case BookingStatus.Completed:
                booking.Confirm();
                booking.Complete();
                break;
            case BookingStatus.Cancelled:
                booking.Cancel();
                break;
        }

        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync();
        return booking.Id;
    }

    private async Task<BookingStatus> GetStatusAsync(Guid bookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = await db.BookingSlots.AsNoTracking().FirstAsync(b => b.Id == bookingId);
        return booking.Status;
    }

    private async Task LoginAsAdminAsync()
        => _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

    private Task<HttpResponseMessage> PostStatusAsync(Guid id, string action)
        => _client.PostAsJsonAsync($"/api/v1/bookings/{id}/status", new { action });

    // ── GET /bookings/all ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_Anonymous_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/bookings/all");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAll_AsCustomer_Returns403()
    {
        var (_, token, _) = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.GetAsync("/api/v1/bookings/all");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetAll_AsAdmin_Returns200WithCustomerInfo()
    {
        var (userId, _, email) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(7, 8));
        await LoginAsAdminAsync();

        var response = await _client.GetAsync("/api/v1/bookings/all");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(bookingId.ToString());
        json.Should().Contain(email); // le courriel du client est résolu via IIdentityService

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── POST /bookings/{id}/status ────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_Anonymous_Returns401()
    {
        var response = await PostStatusAsync(Guid.NewGuid(), "confirm");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateStatus_AsCustomer_Returns403()
    {
        var (userId, token, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(14, 8));
        _client.SetBearerToken(token);

        var response = await PostStatusAsync(bookingId, "confirm");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Theory] // transitions légales : Pending→Confirmed|Cancelled ; Confirmed→Completed|Cancelled
    [InlineData(BookingStatus.Pending, "confirm", BookingStatus.Confirmed)]
    [InlineData(BookingStatus.Pending, "cancel", BookingStatus.Cancelled)]
    [InlineData(BookingStatus.Confirmed, "complete", BookingStatus.Completed)]
    [InlineData(BookingStatus.Confirmed, "cancel", BookingStatus.Cancelled)]
    public async Task UpdateStatus_AsAdmin_LegalTransition_Returns204AndMoves(
        BookingStatus from, string action, BookingStatus expected)
    {
        var (userId, _, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(21, 8), from);
        await LoginAsAdminAsync();

        var response = await PostStatusAsync(bookingId, action);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await GetStatusAsync(bookingId)).Should().Be(expected);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Theory] // transitions illégales → 422 (règle métier de l'agrégat)
    [InlineData(BookingStatus.Pending, "complete")]
    [InlineData(BookingStatus.Completed, "confirm")]
    [InlineData(BookingStatus.Completed, "cancel")]
    [InlineData(BookingStatus.Cancelled, "confirm")]
    [InlineData(BookingStatus.Cancelled, "complete")]
    [InlineData(BookingStatus.Cancelled, "cancel")]
    public async Task UpdateStatus_AsAdmin_IllegalTransition_Returns422AndLeavesStatus(
        BookingStatus from, string action)
    {
        var (userId, _, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(28, 8), from);
        await LoginAsAdminAsync();

        var response = await PostStatusAsync(bookingId, action);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);
        (await GetStatusAsync(bookingId)).Should().Be(from);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Theory] // action inconnue (422 métier) ou vide (422 validation) — même idiome que Orders
    [InlineData("expedier")]
    [InlineData("")]
    public async Task UpdateStatus_AsAdmin_InvalidAction_Returns422(string action)
    {
        var (userId, _, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(35, 8));
        await LoginAsAdminAsync();

        var response = await PostStatusAsync(bookingId, action);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task UpdateStatus_AsAdmin_UnknownBooking_Returns404()
    {
        await LoginAsAdminAsync();

        var response = await PostStatusAsync(Guid.NewGuid(), "confirm");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
