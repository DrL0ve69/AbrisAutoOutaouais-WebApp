using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Guest;

/// <summary>
/// Parcours invité (Épic F) de bout en bout : un visiteur NON authentifié (aucun bearer) peut
/// acheter / louer / réserver en fournissant un <c>guestContact</c>. Vérifie que la commande est
/// créée (201) et rattachée à un <c>CustomerId</c> RÉEL (un AppUser express persisté), et qu'un
/// second POST anonyme avec le MÊME courriel réutilise le même compte (un seul AppUser express).
///
/// Collection « Integration » partagée → WebAppFactory mutualisée (un seul seeder, pas de course
/// IdentitySeeder — leçon L-010).
/// </summary>
[Collection("Integration")]
public sealed class GuestCheckoutEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public GuestCheckoutEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        // Parcours invité : on s'assure qu'aucun bearer ne traîne d'un test précédent (client partagé).
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static DateTime FutureSlot(int addDays)
    {
        var day = DateTime.UtcNow.Date.AddDays(addDays);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return new DateTime(day.Year, day.Month, day.Day, 10, 0, 0, DateTimeKind.Utc);
    }

    private static object Address() => new
    {
        civicNumber = "123",
        street = "rue des Érables",
        apartment = (string?)null,
        city = "Gatineau",
        province = "QC",
        postalCode = "J8X 1A1",
        country = "Canada",
    };

    private static object GuestContact(string email) => new
    {
        firstName = "Jean",
        lastName = "Tremblay",
        email,
        phone = "819-555-0199",
    };

    /// <summary>Seed un produit (achetable + louable) et renvoie son Id.</summary>
    private async Task<Guid> SeedProductAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = ProductCategory.Create($"Abris {suffix}", $"abris-{suffix}");
        var product = Product.Create(
            $"Abri Invité {suffix}", $"abri-invite-{suffix}",
            599m, 50, category.Id, "Abri saisonnier.", rentalPrice: 49m);

        db.ProductCategories.Add(category);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return product.Id;
    }

    private async Task<(Guid UserId, bool IsExpress)> ReadExpressUserAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByEmailAsync(email);
        return (user!.Id, user.IsExpress);
    }

    private async Task<int> CountUsersByEmailAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Users.CountAsync(u => u.NormalizedEmail == email.ToUpperInvariant());
    }

    private async Task<Guid> ReadOrderCustomerAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var order = await db.Orders.AsNoTracking().FirstAsync(o => o.Id == id);
        return order.CustomerId;
    }

    private async Task<Guid> ReadRentalCustomerAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rental = await db.RentalContracts.AsNoTracking().FirstAsync(r => r.Id == id);
        return rental.CustomerId;
    }

    private async Task<Guid> ReadBookingCustomerAsync(Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = await db.BookingSlots.AsNoTracking().FirstAsync(b => b.Id == id);
        return booking.CustomerId;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PlaceOrder_Anonymous_Returns201AndPersistsRealExpressCustomer()
    {
        var productId = await SeedProductAsync();
        var email = $"guest-order-{Guid.NewGuid():N}@test.com";

        var response = await _client.PostAsJsonAsync("/api/v1/orders", new
        {
            lines = new[] { new { productId, quantity = 1 } },
            deliveryType = "Pickup",
            shippingAddress = (object?)null,
            guestContact = GuestContact(email),
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = created.GetProperty("id").GetGuid();

        var (expressId, isExpress) = await ReadExpressUserAsync(email);
        isExpress.Should().BeTrue();
        (await ReadOrderCustomerAsync(orderId)).Should().Be(expressId);
    }

    /// <summary>Sème un modèle d'abri LOUABLE et renvoie son slug.</summary>
    private async Task<string> SeedRentableModelAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var model = RentalTestData.AddRentableModel(db);
        await db.SaveChangesAsync();
        return model.Slug;
    }

    [Fact]
    public async Task CreateRental_Anonymous_Returns201AndPersistsRealExpressCustomer()
    {
        var slug = await SeedRentableModelAsync();
        var email = $"guest-rental-{Guid.NewGuid():N}@test.com";

        var response = await _client.PostAsJsonAsync("/api/v1/rentals", new
        {
            slug,
            lengthCm = 122,
            clearHeightCm = 198,
            startDate = "2026-07-01",
            endDate = "2026-10-01",
            address = Address(),
            guestContact = GuestContact(email),
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        var rentalId = created.GetProperty("id").GetGuid();

        var (expressId, isExpress) = await ReadExpressUserAsync(email);
        isExpress.Should().BeTrue();
        (await ReadRentalCustomerAsync(rentalId)).Should().Be(expressId);
    }

    [Fact]
    public async Task CreateBooking_Anonymous_Returns201AndPersistsRealExpressCustomer()
    {
        var email = $"guest-booking-{Guid.NewGuid():N}@test.com";

        var response = await _client.PostAsJsonAsync("/api/v1/bookings", new
        {
            slotStart = FutureSlot(45),
            type = "Installation",
            address = Address(),
            notes = (string?)null,
            brand = (string?)null,
            model = (string?)null,
            guestContact = GuestContact(email),
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        var bookingId = created.GetProperty("id").GetGuid();

        var (expressId, isExpress) = await ReadExpressUserAsync(email);
        isExpress.Should().BeTrue();
        (await ReadBookingCustomerAsync(bookingId)).Should().Be(expressId);
    }

    [Fact]
    public async Task TwoAnonymousOrders_SameEmail_ReuseSingleExpressCustomer()
    {
        var productId = await SeedProductAsync();
        var email = $"guest-reuse-{Guid.NewGuid():N}@test.com";

        object Body() => new
        {
            lines = new[] { new { productId, quantity = 1 } },
            deliveryType = "Pickup",
            shippingAddress = (object?)null,
            guestContact = GuestContact(email),
        };

        var first = await _client.PostAsJsonAsync("/api/v1/orders", Body());
        var second = await _client.PostAsJsonAsync("/api/v1/orders", Body());

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Created);

        var firstId = (await first.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var secondId = (await second.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var firstCustomer = await ReadOrderCustomerAsync(firstId);
        var secondCustomer = await ReadOrderCustomerAsync(secondId);

        // Même CustomerId réutilisé, et un SEUL AppUser express en base pour ce courriel.
        secondCustomer.Should().Be(firstCustomer);
        (await CountUsersByEmailAsync(email)).Should().Be(1);
    }
}
