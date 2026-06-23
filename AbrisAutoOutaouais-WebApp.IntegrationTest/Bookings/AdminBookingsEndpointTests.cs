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

    /// <summary>
    /// Sème une réservation au statut voulu via le flux RÉEL (EPIC 7.3). Une réservation naît
    /// PendingPayment ; Confirmed s'obtient en attachant une référence puis en l'activant (paiement
    /// réconcilié), Completed enchaîne Complete, Cancelled annule. Le statut PendingPayment (réf
    /// attachée, non confirmée) sert à tester la confirmation de paiement.
    /// </summary>
    private async Task<Guid> SeedBookingAsync(Guid customerId, DateTime slotStart, BookingStatus status = BookingStatus.PendingPayment)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var booking = BookingSlot.Create(customerId, slotStart, 120, BookingType.Installation,
            Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1"));
        booking.AttachPaymentReference("REF-SEED-BOOK");
        switch (status)
        {
            case BookingStatus.Confirmed:
                booking.Activate(DateTime.UtcNow);
                break;
            case BookingStatus.Completed:
                booking.Activate(DateTime.UtcNow);
                booking.Complete();
                break;
            case BookingStatus.Cancelled:
                booking.Cancel();
                break;
            // BookingStatus.PendingPayment : on laisse la réservation en attente (réf attachée, non confirmée).
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

    private Task<HttpResponseMessage> ConfirmPaymentAsync(Guid id)
        => _client.PostAsync($"/api/v1/bookings/{id}/confirm-payment", null);

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

    [Theory] // transitions légales (post-EPIC 7.3) : PendingPayment→Cancelled ; Confirmed→Completed|Cancelled.
    // Le statut Pending legacy n'est plus produit par Create (la voie de confirmation est le paiement,
    // PendingPayment→Confirmed via confirm-payment, couvert plus bas).
    [InlineData(BookingStatus.PendingPayment, "cancel", BookingStatus.Cancelled)]
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
    [InlineData(BookingStatus.PendingPayment, "confirm")] // la confirmation passe par le paiement, pas Confirm
    [InlineData(BookingStatus.PendingPayment, "complete")]
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

    // ── POST /bookings/{id}/confirm-payment (EPIC 7.3) ─────────────────────────

    [Fact]
    public async Task ConfirmPayment_Anonymous_Returns401()
    {
        var response = await ConfirmPaymentAsync(Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ConfirmPayment_AsCustomer_Returns403()
    {
        var (userId, token, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(40, 8), BookingStatus.PendingPayment);
        _client.SetBearerToken(token);

        var response = await ConfirmPaymentAsync(bookingId);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await GetStatusAsync(bookingId)).Should().Be(BookingStatus.PendingPayment);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task ConfirmPayment_AsAdmin_OnPendingBooking_Returns204AndConfirms()
    {
        var (userId, _, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(42, 8), BookingStatus.PendingPayment);
        await LoginAsAdminAsync();

        var response = await ConfirmPaymentAsync(bookingId);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await GetStatusAsync(bookingId)).Should().Be(BookingStatus.Confirmed);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task ConfirmPayment_AsAdmin_AlreadyConfirmed_Returns422()
    {
        var (userId, _, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(userId, Slot(43, 8), BookingStatus.PendingPayment);
        await LoginAsAdminAsync();

        await ConfirmPaymentAsync(bookingId);                 // 1er → 204 (Confirmed)
        var second = await ConfirmPaymentAsync(bookingId);    // 2ᵉ → 422 (déjà confirmé, L-046)

        second.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await second.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task ConfirmPayment_AsAdmin_UnknownBooking_Returns404()
    {
        await LoginAsAdminAsync();

        var response = await ConfirmPaymentAsync(Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

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
