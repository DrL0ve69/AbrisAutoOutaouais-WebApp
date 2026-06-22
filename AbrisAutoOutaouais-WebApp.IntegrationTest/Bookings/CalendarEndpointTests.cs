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

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Bookings;

/// <summary>
/// Endpoint GET /api/v1/bookings/calendar (vue planning, US-11.1). Vraie pile HTTP + JWT réel.
/// Couvre l'autorisation (401 anonyme, 403 Customer, 200 Staff, 200 Admin — Staff et Admin voient
/// TOUT le calendrier) et le respect de la fenêtre de dates.
/// </summary>
[Collection("Integration")]
public sealed class CalendarEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public CalendarEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    /// <summary>Début de créneau futur, jour ouvré, aligné sur la grille (08/10/12/14 h UTC).</summary>
    private static DateTime Slot(int addDays, int hourUtc)
    {
        var day = DateTime.UtcNow.Date.AddDays(addDays);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return new DateTime(day.Year, day.Month, day.Day, hourUtc, 0, 0, DateTimeKind.Utc);
    }

    private static string Date(DateTime d) => d.ToString("yyyy-MM-dd");

    private async Task<(Guid UserId, string Token, string Email)> RegisterAndLoginAsync(string? role = null)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"cal-{suffix}@test.com";
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
        var registered = await register.Content.ReadFromJsonAsync<JsonElement>();
        var userId = registered.GetProperty("userId").GetGuid();

        // Promotion éventuelle au rôle Staff (les rôles sont semés par IdentitySeeder).
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
        return (userId, body.GetProperty("token").GetString()!, email);
    }

    private async Task<Guid> SeedBookingAsync(Guid customerId, DateTime slotStart)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var booking = BookingSlot.Create(customerId, slotStart, 120, BookingType.Installation,
            Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1"));
        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync();
        return booking.Id;
    }

    private string CalendarUrl(DateTime from, DateTime to)
        => $"/api/v1/bookings/calendar?from={Date(from)}&to={Date(to)}";

    // ── Autorisation ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCalendar_Anonymous_Returns401()
    {
        var response = await _client.GetAsync(CalendarUrl(Slot(1, 8), Slot(30, 8)));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetCalendar_AsCustomer_Returns403()
    {
        var (_, token, _) = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.GetAsync(CalendarUrl(Slot(1, 8), Slot(30, 8)));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetCalendar_AsStaff_Returns200WithAllBookings()
    {
        // Staff voit TOUT le calendrier (réservation d'un AUTRE client incluse — décision US-11.1).
        var (customerId, _, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(customerId, Slot(7, 8));

        var (_, staffToken, _) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(staffToken);

        var response = await _client.GetAsync(CalendarUrl(Slot(1, 8), Slot(30, 8)));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(bookingId.ToString());

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetCalendar_AsAdmin_Returns200WithAllBookings()
    {
        var (customerId, _, _) = await RegisterAndLoginAsync();
        var bookingId = await SeedBookingAsync(customerId, Slot(8, 10));

        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.GetAsync(CalendarUrl(Slot(1, 8), Slot(30, 8)));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(bookingId.ToString());

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Fenêtre de dates ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCalendar_RespectsDateWindow_ExcludesOutOfRange()
    {
        var (customerId, _, _) = await RegisterAndLoginAsync();
        var inRange = await SeedBookingAsync(customerId, Slot(5, 8));
        var outOfRange = await SeedBookingAsync(customerId, Slot(60, 8)); // bien après To

        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.GetAsync(CalendarUrl(Slot(1, 8), Slot(10, 8)));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(inRange.ToString());
        json.Should().NotContain(outOfRange.ToString());

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetCalendar_ToBeforeFrom_Returns422()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.GetAsync(CalendarUrl(Slot(30, 8), Slot(1, 8)));

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
