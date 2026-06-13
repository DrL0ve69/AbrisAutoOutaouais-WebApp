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

    /// <summary>Seed d'une location « Active » appartenant à <paramref name="customerId"/>.</summary>
    private async Task<Guid> SeedRentalAsync(Guid customerId)
    {
        var suffix = Guid.NewGuid().ToString("N");
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var product = Product.Create($"Abri Loc {suffix}", $"abri-loc-{suffix}",
            599m, 10, Guid.NewGuid(), "Abri saisonnier.", 49m);
        var rental = RentalContract.Create(customerId, product,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1),
            Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1"));

        db.Products.Add(product);
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
}
