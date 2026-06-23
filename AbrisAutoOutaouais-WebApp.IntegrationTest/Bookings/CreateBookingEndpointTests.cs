using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Bookings;

/// <summary>
/// Bout en bout de POST /api/v1/bookings pour le fold-in « marque/modèle » (Épic C) :
/// la marque ShelterLogic est rejetée (422) ; une autre marque est acceptée (201) et
/// marque/modèle persistent en base ; une réservation sans marque a Brand/Model NULL.
/// Collection « Integration » partagée → WebAppFactory mutualisée (un seul seeder).
/// </summary>
[Collection("Integration")]
public sealed class CreateBookingEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public CreateBookingEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    private static DateTime Slot(int addDays, int hourUtc)
    {
        var day = DateTime.UtcNow.Date.AddDays(addDays);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return new DateTime(day.Year, day.Month, day.Day, hourUtc, 0, 0, DateTimeKind.Utc);
    }

    private async Task<string> RegisterAndLoginAsync()
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
        return body.GetProperty("token").GetString()!;
    }

    private static object Payload(DateTime slot, string? brand = null, string? model = null) => new
    {
        slotStart = slot,
        type = "Installation",
        address = new
        {
            civicNumber = "123",
            street = "rue des Érables",
            apartment = (string?)null,
            city = "Gatineau",
            province = "QC",
            postalCode = "J8X 1A1",
            country = "Canada",
        },
        notes = (string?)null,
        brand,
        model,
    };

    private async Task<(string? Brand, string? Model)> ReadBookingAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = await db.BookingSlots.AsNoTracking().FirstAsync(b => b.Id == id);
        return (booking.Brand, booking.Model);
    }

    [Fact]
    public async Task Create_WithShelterLogicBrand_Returns422()
    {
        var token = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync(
            "/api/v1/bookings", Payload(Slot(40, 10), brand: "ShelterLogic"));

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_WithOtherBrand_Returns201AndPersistsBrandModel()
    {
        var token = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync(
            "/api/v1/bookings", Payload(Slot(41, 10), brand: "Abri Plus", model: "Garage 12x20"));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();

        // La réponse porte aussi les instructions de paiement (virement Interac, EPIC 7.3).
        var payment = created.GetProperty("payment");
        payment.GetProperty("reference").GetString().Should().NotBeNullOrWhiteSpace();
        payment.GetProperty("recipientEmail").GetString().Should().NotBeNullOrWhiteSpace();
        payment.GetProperty("amount").GetDecimal().Should().Be(150.00m); // Installation = 150 $

        var (brand, model) = await ReadBookingAsync(id);
        brand.Should().Be("Abri Plus");
        model.Should().Be("Garage 12x20");

        // La réservation naît EN ATTENTE DE PAIEMENT avec la référence attachée mais non confirmée.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var booking = await db.BookingSlots.AsNoTracking().FirstAsync(b => b.Id == id);
            booking.Status.Should().Be(BookingStatus.PendingPayment);
            booking.Amount.Should().Be(150.00m);
            booking.Payment.Should().NotBeNull();
            booking.Payment!.Reference.Should().Be(payment.GetProperty("reference").GetString());
            booking.Payment.ConfirmedAt.Should().BeNull();
        }

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_WithoutBrand_Returns201AndStoresNull()
    {
        var token = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync("/api/v1/bookings", Payload(Slot(42, 10)));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();

        var (brand, model) = await ReadBookingAsync(id);
        brand.Should().BeNull();
        model.Should().BeNull();

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
