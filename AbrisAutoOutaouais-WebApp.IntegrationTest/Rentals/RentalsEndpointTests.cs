using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Domain.ValueObjects;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Rentals;

/// <summary>
/// Tests de bout en bout de l'annulation d'une location : POST /api/v1/rentals/{id}/cancel.
/// Vraie pile HTTP + JWT réel + DB InMemory. Couvre la propriété (un client n'annule que
/// SES locations → 404), la règle métier (déjà annulée → 422) et l'auth (anonyme → 401).
/// </summary>
[Collection("Integration")]
public sealed class RentalsEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public RentalsEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        // Le HttpClient est partagé : on repart sans en-tête d'autorisation à chaque test.
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Crée un client unique et renvoie son id + un JWT valide.</summary>
    private async Task<(Guid UserId, string Token)> RegisterAndLoginAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"loc-{suffix}@test.com";
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

    /// <summary>
    /// Seed d'une location « Active » appartenant à <paramref name="customerId"/>. Un nouveau contrat
    /// naît PendingPayment (EPIC 7.2) : on attache une référence et on l'ACTIVE pour obtenir un contrat
    /// genuinely actif (les tests d'annulation portent sur des contrats actifs).
    /// </summary>
    private async Task<Guid> SeedRentalAsync(Guid customerId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var model = RentalTestData.AddRentableModel(db);
        var rental = RentalContract.CreateForModel(customerId, model, 122, 198,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1),
            Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1"));
        rental.AttachPaymentReference("REF-SEED-LOC");
        rental.Activate(DateTime.UtcNow);

        db.RentalContracts.Add(rental);
        await db.SaveChangesAsync();
        return rental.Id;
    }

    private async Task<RentalStatus> GetStatusAsync(Guid rentalId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rental = await db.RentalContracts.AsNoTracking().FirstAsync(r => r.Id == rentalId);
        return rental.Status;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Cancel_Owner_Returns204AndMarksCancelled()
    {
        var (userId, token) = await RegisterAndLoginAsync();
        var rentalId = await SeedRentalAsync(userId);
        _client.SetBearerToken(token);

        var response = await _client.PostAsync($"/api/v1/rentals/{rentalId}/cancel", null);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await GetStatusAsync(rentalId)).Should().Be(RentalStatus.Cancelled);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Cancel_AlreadyCancelled_Returns422()
    {
        var (userId, token) = await RegisterAndLoginAsync();
        var rentalId = await SeedRentalAsync(userId);
        _client.SetBearerToken(token);

        await _client.PostAsync($"/api/v1/rentals/{rentalId}/cancel", null);
        var second = await _client.PostAsync($"/api/v1/rentals/{rentalId}/cancel", null);

        second.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await second.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Cancel_NonOwner_Returns404AndLeavesRentalActive()
    {
        var (ownerId, _) = await RegisterAndLoginAsync();
        var rentalId = await SeedRentalAsync(ownerId);
        var (_, strangerToken) = await RegisterAndLoginAsync();
        _client.SetBearerToken(strangerToken);

        var response = await _client.PostAsync($"/api/v1/rentals/{rentalId}/cancel", null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await GetStatusAsync(rentalId)).Should().Be(RentalStatus.Active);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Cancel_Anonymous_Returns401()
    {
        var response = await _client.PostAsync($"/api/v1/rentals/{Guid.NewGuid()}/cancel", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── POST /rentals (création sur modèle paramétrique) ───────────────────────

    /// <summary>Sème un modèle LOUABLE (ou non) et retourne son slug.</summary>
    private async Task<string> SeedRentableModelAsync(int? monthlyRentalCents = 4900)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        // Le helper crée toujours un modèle louable (tarif > 0) ; on retire le tarif ensuite si on
        // veut un modèle NON louable (SetMonthlyRental(null)) — Create rejette un tarif <= 0.
        var model = RentalTestData.AddRentableModel(db);
        if (monthlyRentalCents is null)
            model.SetMonthlyRental(null);     // modèle NON louable
        else
            model.SetMonthlyRental(monthlyRentalCents);
        await db.SaveChangesAsync();
        return model.Slug;
    }

    private static object CreateBody(string slug, int lengthCm = 122, int clearHeightCm = 198) => new
    {
        slug,
        lengthCm,
        clearHeightCm,
        startDate = "2026-07-01",
        endDate = "2026-10-01",
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
    };

    [Fact]
    public async Task Create_RentableModelValidSize_Returns201AndPersistsSnapshot()
    {
        var (_, token) = await RegisterAndLoginAsync();
        var slug = await SeedRentableModelAsync();
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync("/api/v1/rentals", CreateBody(slug));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var id = body.GetProperty("id").GetGuid();

        // La réponse porte aussi les instructions de paiement (virement Interac, EPIC 7.2).
        var payment = body.GetProperty("payment");
        payment.GetProperty("reference").GetString().Should().NotBeNullOrWhiteSpace();
        payment.GetProperty("recipientEmail").GetString().Should().NotBeNullOrWhiteSpace();
        payment.GetProperty("amount").GetDecimal().Should().Be(49.00m);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rental = await db.RentalContracts.AsNoTracking().FirstAsync(r => r.Id == id);
        rental.ShelterModelSlug.Should().Be(slug);
        rental.ConfiguredLengthCm.Should().Be(122);
        rental.ConfiguredClearHeightCm.Should().Be(198);
        rental.MonthlyRate.Should().Be(49.00m);
        rental.ProductId.Should().BeNull();
        // Le contrat naît EN ATTENTE DE PAIEMENT, avec la référence attachée mais non confirmée.
        rental.Status.Should().Be(RentalStatus.PendingPayment);
        rental.Payment.Should().NotBeNull();
        rental.Payment!.Reference.Should().Be(payment.GetProperty("reference").GetString());
        rental.Payment.ConfirmedAt.Should().BeNull();

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_NonRentableModel_Returns422()
    {
        var (_, token) = await RegisterAndLoginAsync();
        var slug = await SeedRentableModelAsync(monthlyRentalCents: null);
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync("/api/v1/rentals", CreateBody(slug));

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_OffGridSize_Returns422()
    {
        var (_, token) = await RegisterAndLoginAsync();
        var slug = await SeedRentableModelAsync();
        _client.SetBearerToken(token);

        // 200 cm n'est pas aligné sur le pas (122, 244, 366 seulement).
        var response = await _client.PostAsJsonAsync("/api/v1/rentals", CreateBody(slug, lengthCm: 200));

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_UnknownSlug_Returns404()
    {
        var (_, token) = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync("/api/v1/rentals", CreateBody("slug-inexistant"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── GET /shelters/rentable ─────────────────────────────────────────────────

    [Fact]
    public async Task GetRentable_ReturnsOnlyModelsWithMonthlyRate()
    {
        // Un modèle LOUABLE + un modèle NON louable (tarif retiré) coexistent.
        string rentableSlug, nonRentableSlug;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var rentable = RentalTestData.AddRentableModel(db, 4900);
            var nonRentable = RentalTestData.AddRentableModel(db, 4900);
            nonRentable.SetMonthlyRental(null);
            rentableSlug = rentable.Slug;
            nonRentableSlug = nonRentable.Slug;
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync("/api/v1/shelters/rentable");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(rentableSlug);
        json.Should().NotContain(nonRentableSlug);

        var models = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        var mine = models!.Single(m => m.GetProperty("slug").GetString() == rentableSlug);
        mine.GetProperty("monthlyRentalPrice").GetDecimal().Should().Be(49.00m);
        mine.GetProperty("clearHeightOptionsCm").GetArrayLength().Should().BeGreaterThan(0);
        mine.GetProperty("priceGrid").GetArrayLength().Should().BeGreaterThan(0);
    }
}
