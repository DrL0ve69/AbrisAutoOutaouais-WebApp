using AbrisAutoOutaouais_WebApp.Application.Catalog.Queries.ResolveCatalogSlug;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Catalog;

/// <summary>
/// Tests de bout en bout pour <c>GET /api/v1/catalog/{slug}/type</c> (résolveur de type de slug,
/// rework EPIC 9). Vraie stack HTTP + DB InMemory. Le <c>WebAppFactory</c> ne lance QUE
/// l'IdentitySeeder : on sème donc nos propres modèle/produit via un scope DI, avec des slugs uniques
/// pour isoler les tests dans le store InMemory partagé (L-010).
/// </summary>
[Collection("Integration")]  // L-010 : partage le WebAppFactory, pas de parallélisme.
public sealed class CatalogEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public CatalogEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetType_ShelterModelSlug_ReturnsShelter()
    {
        await SeedShelterModelAsync("type-abri-modele", "cat-type-abri");

        var response = await _client.GetAsync("/api/v1/catalog/type-abri-modele/type");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<CatalogSlugTypeDto>();
        dto!.Type.Should().Be("shelter");
    }

    [Fact]
    public async Task GetType_ProductSlug_ReturnsProduct()
    {
        await SeedProductAsync("type-toile-fixe", "cat-type-produit");

        var response = await _client.GetAsync("/api/v1/catalog/type-toile-fixe/type");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<CatalogSlugTypeDto>();
        dto!.Type.Should().Be("product");
    }

    [Fact]
    public async Task GetType_UnknownSlug_Returns404()
    {
        var response = await _client.GetAsync("/api/v1/catalog/inexistant-xyz/type");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(404);
    }

    /// <summary>
    /// Précédence : un slug présent À LA FOIS dans ShelterModels et Products résout « shelter » — le
    /// handler teste les modèles d'abord. Verrouille l'ordre des deux <c>AnyAsync</c>.
    /// </summary>
    [Fact]
    public async Task GetType_SlugInBothModelsAndProducts_ReturnsShelter_ShelterTakesPrecedence()
    {
        await SeedShelterModelAsync("type-collision", "cat-collision-abri");
        await SeedProductAsync("type-collision", "cat-collision-produit");

        var response = await _client.GetAsync("/api/v1/catalog/type-collision/type");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<CatalogSlugTypeDto>();
        dto!.Type.Should().Be("shelter");
    }

    /// <summary>
    /// Un modèle SOFT-DELETED (<c>IsDeleted = 1</c> via le SoftDeleteInterceptor) n'est plus visible
    /// par <c>db.ShelterModels.AnyAsync</c> (filtre global <c>!IsDeleted</c>) : sans produit actif
    /// portant le même slug, le résolveur répond 404. Pin du filtre dont dépend le handler.
    /// </summary>
    [Fact]
    public async Task GetType_SoftDeletedModelSlug_Returns404()
    {
        await SeedShelterModelAsync("type-abri-supprime", "cat-abri-supprime");
        await SoftDeleteShelterModelAsync("type-abri-supprime");

        var response = await _client.GetAsync("/api/v1/catalog/type-abri-supprime/type");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>Sème une catégorie + un modèle d'abri paramétrique minimal (slugs uniques).</summary>
    private async Task SeedShelterModelAsync(string slug, string categorySlug)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = ProductCategory.Create($"Cat {categorySlug}", categorySlug);
        var model = ShelterModel.Create(
            slug, $"Modèle {slug}", category.Id,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 366,
            widthsCm: [335], clearHeightsCm: [198],
            priceEntries:
            [
                new ShelterModel.PriceEntryInput(122, 198, 34900),
            ]);

        db.ProductCategories.Add(category);
        db.ShelterModels.Add(model);
        await db.SaveChangesAsync();
    }

    /// <summary>Sème une catégorie + un produit fixe minimal (slugs uniques).</summary>
    private async Task SeedProductAsync(string slug, string categorySlug)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = ProductCategory.Create($"Cat {categorySlug}", categorySlug);
        var product = Product.Create($"Produit {slug}", slug, price: 99.00m, stock: 5, category.Id);

        db.ProductCategories.Add(category);
        db.Products.Add(product);
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Supprime (soft delete) le modèle d'abri portant ce slug via le VRAI chemin : <c>db.Remove</c>
    /// → le <c>SoftDeleteInterceptor</c> bascule <c>IsDeleted = 1</c> (l'entité reste en base mais
    /// devient invisible au filtre global <c>!IsDeleted</c>).
    /// </summary>
    private async Task SoftDeleteShelterModelAsync(string slug)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Argument de type explicite : sous .NET 10, FirstAsync/ToListAsync sont en collision entre
        // EF Core et System.Linq.AsyncEnumerable (déduction impossible). Le slug est unique → 1 élément.
        var model = (await db.ShelterModels.Where(m => m.Slug == slug).ToListAsync<ShelterModel>())[0];
        db.ShelterModels.Remove(model);
        await db.SaveChangesAsync();
    }
}
