using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Shelters;

/// <summary>
/// CRUD écriture du référentiel ShelterModel (EPIC 9.5) : vraie pile HTTP + JWT réel + DB InMemory.
/// Couvre l'autorisation (401 anonyme, 403 Customer, 2xx Admin), la validation (422), le conflit
/// de slug (409), et le round-trip POST → GET → PUT → DELETE → 404.
/// <c>[Collection("Integration")]</c> OBLIGATOIRE (L-010) : partage un seul WebAppFactory.
/// </summary>
[Collection("Integration")]
public sealed class SheltersAdminEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public SheltersAdminEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Sème une catégorie produit et renvoie son Id (WebAppFactory ne sème que l'identité).</summary>
    private async Task<Guid> SeedCategoryAsync(string slug)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var category = ProductCategory.Create($"Cat {slug}", $"cat-{slug}-{Guid.NewGuid():N}");
        db.ProductCategories.Add(category);
        await db.SaveChangesAsync();
        return category.Id;
    }

    private static object ValidBody(Guid categoryId, string slug) => new
    {
        slug,
        name = "Abri paramétrique",
        categoryId,
        lengthStepCm = 122,
        minLengthCm = 122,
        maxLengthCm = 1830,
        widthsCm = new[] { 335, 366 },
        clearHeightsCm = new[] { 198 },
    };

    private async Task<string> RegisterAndLoginAsCustomerAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"cust-{suffix}@test.com";
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
        return await AuthHelper.LoginAsync(_client, email, password);
    }

    // ── Autorisation ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_Anonymous_Returns401()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/shelters", ValidBody(Guid.NewGuid(), "abri-anon"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_AsCustomer_Returns403()
    {
        _client.SetBearerToken(await RegisterAndLoginAsCustomerAsync());

        var response = await _client.PostAsJsonAsync(
            "/api/v1/shelters", ValidBody(Guid.NewGuid(), "abri-cust"));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── CRUD heureux (Admin) ─────────────────────────────────────────────────

    [Fact]
    public async Task FullCrud_AsAdmin_CreateGetUpdateDelete_RoundTrips()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));
        var catId = await SeedCategoryAsync("crud");

        // CREATE → 201 — dimensions VOLONTAIREMENT distinctes de celles du PUT (largeur unique 244,
        // hauteur unique 198) pour que l'assertion post-PUT prouve le REMPLACEMENT, pas un no-op.
        var create = await _client.PostAsJsonAsync("/api/v1/shelters", new
        {
            slug = "abri-crud",
            name = "Abri paramétrique",
            categoryId = catId,
            lengthStepCm = 122,
            minLengthCm = 122,
            maxLengthCm = 1830,
            widthsCm = new[] { 244 },
            clearHeightsCm = new[] { 198 },
        });
        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await create.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();
        id.Should().NotBeEmpty();

        // GET slug → 200
        var get = await _client.GetAsync("/api/v1/shelters/abri-crud");
        get.StatusCode.Should().Be(HttpStatusCode.OK);

        // UPDATE → 204 (slug inchangé). Nouvelles dimensions DIFFÉRENTES de la création, et fournies
        // dans le désordre (366,305) pour vérifier aussi le tri canonique côté lecture.
        var put = await _client.PutAsJsonAsync($"/api/v1/shelters/{id}", new
        {
            id,
            name = "Abri reconfiguré",
            categoryId = catId,
            lengthStepCm = 122,
            minLengthCm = 122,
            maxLengthCm = 1830,
            widthsCm = new[] { 366, 305 },
            clearHeightsCm = new[] { 213 },
        });
        put.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // GET FRAIS (round-trip HTTP, instance non suivie) : le slug est resté abri-crud (immuable),
        // le nom est mis à jour ET les dimensions reflètent les NOUVELLES valeurs triées — donc les
        // anciennes lignes (244 / 198) ont bien été RETIRÉES (cœur de la déviation owned → entité
        // régulière : RemoveRange/AddRange). Une régression de ce remplacement serait attrapée ici
        // (L-005/L-009).
        var afterPut = await (await _client.GetAsync("/api/v1/shelters/abri-crud"))
            .Content.ReadFromJsonAsync<JsonElement>();
        afterPut.GetProperty("name").GetString().Should().Be("Abri reconfiguré");

        afterPut.GetProperty("widthOptionsCm").EnumerateArray()
            .Select(e => e.GetInt32()).Should().Equal(305, 366);
        afterPut.GetProperty("clearHeightOptionsCm").EnumerateArray()
            .Select(e => e.GetInt32()).Should().Equal(213);

        // DELETE → 204 puis GET → 404
        var delete = await _client.DeleteAsync($"/api/v1/shelters/{id}");
        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var afterDelete = await _client.GetAsync("/api/v1/shelters/abri-crud");
        afterDelete.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Validation & conflit ─────────────────────────────────────────────────

    [Fact]
    public async Task Create_AsAdmin_WithMinGreaterThanMax_Returns422()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));
        var catId = await SeedCategoryAsync("422");

        var response = await _client.PostAsJsonAsync("/api/v1/shelters", new
        {
            slug = "abri-invalide",
            name = "Abri invalide",
            categoryId = catId,
            lengthStepCm = 122,
            minLengthCm = 1830,   // min ≥ max → invalide
            maxLengthCm = 1830,
            widthsCm = new[] { 335 },
            clearHeightsCm = new[] { 198 },
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_AsAdmin_WithDuplicateSlug_Returns409()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));
        var catId = await SeedCategoryAsync("dup");

        var first = await _client.PostAsJsonAsync(
            "/api/v1/shelters", ValidBody(catId, "abri-dup"));
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await _client.PostAsJsonAsync(
            "/api/v1/shelters", ValidBody(catId, "Abri-Dup"));  // même slug normalisé

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Update_AsAdmin_UnknownId_Returns404()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));
        var catId = await SeedCategoryAsync("upd404");

        var response = await _client.PutAsJsonAsync($"/api/v1/shelters/{Guid.NewGuid()}", new
        {
            id = Guid.NewGuid(),
            name = "Abri fantôme",
            categoryId = catId,
            lengthStepCm = 122,
            minLengthCm = 122,
            maxLengthCm = 1830,
            widthsCm = new[] { 335 },
            clearHeightsCm = new[] { 198 },
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Delete_AsAdmin_UnknownId_Returns404()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.DeleteAsync($"/api/v1/shelters/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        _client.DefaultRequestHeaders.Authorization = null;
    }
}
