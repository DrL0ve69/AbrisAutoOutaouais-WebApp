using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetShelterCatalog;
using AbrisAutoOutaouais_WebApp.Domain.Entities;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Products;

/// <summary>
/// Tests de bout en bout pour les endpoints /api/v1/products.
/// Utilise une vraie HTTP stack, DB InMemory, JWT réel.
/// </summary>
[Collection("Integration")]  // Partage WebAppFactory — pas de parallélisme
public sealed class ProductsEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public ProductsEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        // Le HttpClient est partagé par la fixture : on repart sans en-tête
        // d'autorisation à chaque test pour éviter qu'un token admin « fuite »
        // d'un test à l'autre (sinon Create_AsAnonymous serait authentifié).
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── GET /api/v1/products ─────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_Anonymous_Returns200WithEmptyList()
    {
        var response = await _client.GetAsync("/api/v1/products");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PaginatedList<ProductDto>>();
        body.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAll_WithSeededProducts_ReturnsPaginatedList()
    {
        await DbHelper.SeedProductAsync(_factory.Services, slug: "test-pagination");

        var response = await _client.GetAsync("/api/v1/products?page=1&pageSize=12");
        var body = await response.Content.ReadFromJsonAsync<PaginatedList<ProductDto>>();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body!.Items.Should().NotBeEmpty();
    }

    // ── GET /api/v1/products/{slug} ─────────────────────────────────────────

    [Fact]
    public async Task GetBySlug_ExistingProduct_Returns200()
    {
        await DbHelper.SeedProductAsync(_factory.Services, slug: "abri-unique-slug");

        var response = await _client.GetAsync("/api/v1/products/abri-unique-slug");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ProductDto>();
        dto!.Slug.Should().Be("abri-unique-slug");
    }

    [Fact]
    public async Task GetBySlug_UnknownSlug_Returns404WithProblemDetails()
    {
        var response = await _client.GetAsync("/api/v1/products/inexistant-xyz");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Vérifie que la réponse est bien un ProblemDetails RFC 9457
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(404);
        problem.Title.Should().Be("Ressource introuvable");
    }

    // ── POST /api/v1/products ────────────────────────────────────────────────

    [Fact]
    public async Task Create_AsAnonymous_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/products",
            new { name = "Test", slug = "test", price = 100, stock = 5, categoryId = Guid.NewGuid() });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_AsAdmin_Returns201WithId()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        // Seeder une catégorie d'abord
        await DbHelper.SeedProductAsync(_factory.Services, slug: "categorie-seed");
        var db = _factory.Services.CreateScope().ServiceProvider
            .GetRequiredService<ApplicationDbContext>();
        var catId = await db.ProductCategories.Select(c => c.Id).FirstAsync();

        var response = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "Abri Double Nouveau",
            slug = "abri-double-nouveau",
            price = 499.99,
            stock = 3,
            categoryId = catId,
            description = "Abri pour deux voitures",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        // Le contrôleur renvoie CreatedAtAction(..., new { id }) → objet { "id": "..." }.
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        payload.GetProperty("id").GetGuid().Should().NotBeEmpty();

        // Nettoyage : reset le header
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_AsAdmin_WithDimensions_PersistsAndGetBySlugReadsThemBack()
    {
        // Round-trip dimensions (analogue L-001 via la stack HTTP réelle) : POST avec
        // dims → GET /{slug} relit les 3 valeurs.
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        await DbHelper.SeedProductAsync(_factory.Services, slug: "categorie-seed-dims");
        var db = _factory.Services.CreateScope().ServiceProvider
            .GetRequiredService<ApplicationDbContext>();
        var catId = await db.ProductCategories.Select(c => c.Id).FirstAsync();

        var create = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "Abri Dimensionne",
            price = 499.99,
            stockQuantity = 3,
            categoryId = catId,
            description = "Abri avec dimensions hors-tout",
            widthCm = 335,
            lengthCm = 488,
            heightCm = 244,
        });
        create.StatusCode.Should().Be(HttpStatusCode.Created);

        var get = await _client.GetAsync("/api/v1/products/abri-dimensionne");
        get.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await get.Content.ReadFromJsonAsync<ProductDto>();
        dto!.WidthCm.Should().Be(335);
        dto.LengthCm.Should().Be(488);
        dto.HeightCm.Should().Be(244);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_AsAdmin_WithoutDimensions_GetBySlugReadsNull()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        await DbHelper.SeedProductAsync(_factory.Services, slug: "categorie-seed-nodim");
        var db = _factory.Services.CreateScope().ServiceProvider
            .GetRequiredService<ApplicationDbContext>();
        var catId = await db.ProductCategories.Select(c => c.Id).FirstAsync();

        var create = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "Abri Sans Dimensions",
            price = 99.99,
            stockQuantity = 7,
            categoryId = catId,
            description = "Accessoire sans dimensions hors-tout",
        });
        create.StatusCode.Should().Be(HttpStatusCode.Created);

        var get = await _client.GetAsync("/api/v1/products/abri-sans-dimensions");
        var dto = await get.Content.ReadFromJsonAsync<ProductDto>();
        dto!.WidthCm.Should().BeNull();
        dto.LengthCm.Should().BeNull();
        dto.HeightCm.Should().BeNull();

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_AsAdmin_WithOutOfRangeDimension_Returns422()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        await DbHelper.SeedProductAsync(_factory.Services, slug: "categorie-seed-badim");
        var db = _factory.Services.CreateScope().ServiceProvider
            .GetRequiredService<ApplicationDbContext>();
        var catId = await db.ProductCategories.Select(c => c.Id).FirstAsync();

        var response = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "Abri Trop Petit",
            price = 199.99,
            stockQuantity = 1,
            categoryId = catId,
            description = "Largeur sous la borne minimale",
            widthCm = 10,  // < 50 → invalide
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Update_AsAdmin_TogglesDimensionsBothWays()
    {
        // Round-trip PUT (L-001) : null → valeur, puis valeur → null.
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        await DbHelper.SeedProductAsync(_factory.Services, slug: "categorie-seed-putdim");
        var db = _factory.Services.CreateScope().ServiceProvider
            .GetRequiredService<ApplicationDbContext>();
        var catId = await db.ProductCategories.Select(c => c.Id).FirstAsync();

        var create = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "Abri A Mesurer",
            price = 299.99,
            stockQuantity = 5,
            categoryId = catId,
            description = "Dimensions ajoutées plus tard",
        });
        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await _client.GetAsync("/api/v1/products/abri-a-mesurer");
        var initial = await created.Content.ReadFromJsonAsync<ProductDto>();
        initial!.WidthCm.Should().BeNull();
        var id = initial.Id;

        // null → valeur
        var put1 = await _client.PutAsJsonAsync($"/api/v1/products/{id}", new
        {
            id,
            name = "Abri A Mesurer",
            description = "Maintenant dimensionné",
            price = 299.99,
            stock = 5,
            categoryId = catId,
            widthCm = 335,
            lengthCm = 488,
            heightCm = 244,
        });
        put1.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var afterSet = await (await _client.GetAsync("/api/v1/products/abri-a-mesurer"))
            .Content.ReadFromJsonAsync<ProductDto>();
        afterSet!.WidthCm.Should().Be(335);
        afterSet.LengthCm.Should().Be(488);
        afterSet.HeightCm.Should().Be(244);

        // valeur → null
        var put2 = await _client.PutAsJsonAsync($"/api/v1/products/{id}", new
        {
            id,
            name = "Abri A Mesurer",
            description = "Dimensions effacées",
            price = 299.99,
            stock = 5,
            categoryId = catId,
        });
        put2.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var afterClear = await (await _client.GetAsync("/api/v1/products/abri-a-mesurer"))
            .Content.ReadFromJsonAsync<ProductDto>();
        afterClear!.WidthCm.Should().BeNull();
        afterClear.LengthCm.Should().BeNull();
        afterClear.HeightCm.Should().BeNull();

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_AsAdmin_WithInvalidData_Returns422()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        // Tous les champs (non-nullables) sont fournis pour que la liaison réussisse,
        // mais leurs valeurs violent les règles FluentValidation → ValidationException → 422.
        var response = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "",                 // NotEmpty
            description = "desc",       // présent (sinon 400 à la liaison du membre non-nullable)
            price = -10m,              // GreaterThan(0)
            stockQuantity = -5,         // GreaterThanOrEqualTo(0)
            categoryId = Guid.Empty,    // NotEmpty
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── GET /api/v1/products/shelter-catalog ─────────────────────────────────

    /// <summary>Seed direct d'un produit avec marque + modèle + dimensions (G2).</summary>
    private async Task SeedBrandedShelterAsync(
        string name, string slug, string brand, string model,
        int? widthCm = null, int? lengthCm = null, int? heightCm = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var category = ProductCategory.Create($"Cat {slug}", $"cat-{slug}");
        var product = Product.Create(
            name, slug, 199.99m, 5, category.Id,
            widthCm: widthCm, lengthCm: lengthCm, heightCm: heightCm,
            brand: brand, model: model);
        db.ProductCategories.Add(category);
        db.Products.Add(product);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ShelterCatalog_Anonymous_Returns200WithBrandsAndModels()
    {
        // Au moins une marque avec ses modèles + dimensions. Route littérale prime sur {slug}.
        await SeedBrandedShelterAsync(
            "Catalogue Abri A", "catalogue-abri-a", "Catalogue Tempo", "Modèle CA-100",
            widthCm: 335, lengthCm: 488, heightCm: 244);

        var response = await _client.GetAsync("/api/v1/products/shelter-catalog");

        // On obtient bien une LISTE (200), pas un 404 GetBySlug.
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<BrandCatalogDto>>();
        body.Should().NotBeNull();

        var brand = body!.FirstOrDefault(b => b.Brand == "Catalogue Tempo");
        brand.Should().NotBeNull();
        brand!.Models.Should().NotBeEmpty();
        var model = brand.Models.FirstOrDefault(m => m.Model == "Modèle CA-100");
        model.Should().NotBeNull();
        model!.Slug.Should().Be("catalogue-abri-a");
        model.WidthCm.Should().Be(335);
        model.LengthCm.Should().Be(488);
        model.HeightCm.Should().Be(244);
    }

    [Fact]
    public async Task ShelterCatalog_ExcludesProductsWithoutBrandOrModel()
    {
        // Un produit sans marque/modèle (toile, accessoire) ne doit pas apparaître au catalogue.
        await DbHelper.SeedProductAsync(_factory.Services, slug: "catalogue-sans-marque");

        var response = await _client.GetAsync("/api/v1/products/shelter-catalog");
        var body = await response.Content.ReadFromJsonAsync<List<BrandCatalogDto>>();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body!.SelectMany(b => b.Models).Select(m => m.Slug)
            .Should().NotContain("catalogue-sans-marque");
    }
}
