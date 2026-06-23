using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Domain.Entities;
using Domain.ValueObjects;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Rentals;

/// <summary>
/// Endpoints d'administration des locations : GET /api/v1/rentals/all et
/// POST /api/v1/rentals/{id}/admin-cancel. Vraie pile HTTP + JWT réel + DB InMemory.
/// L'annulation admin doit fonctionner SANS vérification de propriété (contrat d'un
/// autre client) mais rester interdite aux clients (403) et aux anonymes (401).
/// </summary>
[Collection("Integration")]
public sealed class AdminRentalsEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public AdminRentalsEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<(Guid UserId, string Token, string Email)> RegisterAndLoginAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"adminr-{suffix}@test.com";
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

    /// <summary>Sème un contrat de location (le produit n'est qu'un instantané — pas persisté).</summary>
    private async Task<Guid> SeedRentalAsync(Guid customerId, RentalStatus status = RentalStatus.Active)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var model = RentalTestData.AddRentableModel(db);
        var contract = RentalContract.CreateForModel(
            customerId, model, 122, 198,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1),
            Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1"));
        if (status == RentalStatus.Cancelled)
            contract.Cancel();

        db.RentalContracts.Add(contract);
        await db.SaveChangesAsync();
        return contract.Id;
    }

    private async Task<RentalStatus> GetStatusAsync(Guid contractId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var contract = await db.RentalContracts.AsNoTracking().FirstAsync(r => r.Id == contractId);
        return contract.Status;
    }

    private async Task LoginAsAdminAsync()
        => _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

    private Task<HttpResponseMessage> AdminCancelAsync(Guid id)
        => _client.PostAsync($"/api/v1/rentals/{id}/admin-cancel", null);

    // ── GET /rentals/all ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_Anonymous_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/rentals/all");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAll_AsCustomer_Returns403()
    {
        var (_, token, _) = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.GetAsync("/api/v1/rentals/all");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetAll_AsAdmin_Returns200WithCustomerInfo()
    {
        var (userId, _, email) = await RegisterAndLoginAsync();
        var contractId = await SeedRentalAsync(userId);
        await LoginAsAdminAsync();

        var response = await _client.GetAsync("/api/v1/rentals/all");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(contractId.ToString());
        json.Should().Contain(email); // le courriel du client est résolu via IIdentityService

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── POST /rentals/{id}/admin-cancel ───────────────────────────────────────

    [Fact]
    public async Task AdminCancel_Anonymous_Returns401()
    {
        var response = await AdminCancelAsync(Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AdminCancel_AsCustomer_EvenOwner_Returns403()
    {
        var (userId, token, _) = await RegisterAndLoginAsync();
        var contractId = await SeedRentalAsync(userId);
        _client.SetBearerToken(token);

        var response = await AdminCancelAsync(contractId);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await GetStatusAsync(contractId)).Should().Be(RentalStatus.Active);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task AdminCancel_AsAdmin_OnAnotherCustomersActiveContract_Returns204AndCancels()
    {
        // Le contrat appartient à un client quelconque — PAS à l'admin (aucune
        // vérification de propriété sur la route admin).
        var (userId, _, _) = await RegisterAndLoginAsync();
        var contractId = await SeedRentalAsync(userId);
        await LoginAsAdminAsync();

        var response = await AdminCancelAsync(contractId);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await GetStatusAsync(contractId)).Should().Be(RentalStatus.Cancelled);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task AdminCancel_AsAdmin_AlreadyCancelled_Returns422()
    {
        var (userId, _, _) = await RegisterAndLoginAsync();
        var contractId = await SeedRentalAsync(userId, RentalStatus.Cancelled);
        await LoginAsAdminAsync();

        var response = await AdminCancelAsync(contractId);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task AdminCancel_AsAdmin_UnknownContract_Returns404()
    {
        await LoginAsAdminAsync();

        var response = await AdminCancelAsync(Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
