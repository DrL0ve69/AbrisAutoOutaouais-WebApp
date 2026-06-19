using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModels;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Shelters;

/// <summary>
/// Tests de bout en bout pour /api/v1/shelters (catalogue des modèles paramétriques, EPIC 9).
/// Vraie stack HTTP + DB InMemory. Le <c>WebAppFactory</c> ne lance QUE l'IdentitySeeder
/// (pas ProductSeeder/ShelterModelSeeder) : on sème donc nos propres modèles via un scope DI.
/// </summary>
[Collection("Integration")]  // L-010 : partage le WebAppFactory, pas de parallélisme (évite la race seeder).
public sealed class SheltersEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public SheltersEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    /// <summary>
    /// Sème une catégorie + un modèle d'abri paramétrique aligné sur le référentiel « simple »
    /// (pas/min 122 cm, base 349 $, 150 $/arche). Slug et catégorie uniques par appel pour
    /// isoler les tests dans la base InMemory partagée.
    /// </summary>
    private async Task<Guid> SeedShelterModelAsync(
        string slug,
        string categorySlug,
        int lengthStepCm = 122,
        int minLengthCm = 122,
        int maxLengthCm = 1830,
        decimal basePrice = 349.00m,
        int pricePerArchCents = 15000,
        IReadOnlyList<int>? widthsCm = null,
        IReadOnlyList<int>? clearHeightsCm = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = ProductCategory.Create($"Cat {categorySlug}", categorySlug);
        var model = ShelterModel.Create(
            slug, $"Modèle {slug}", category.Id,
            lengthStepCm, minLengthCm, maxLengthCm, basePrice, pricePerArchCents,
            widthsCm ?? [335, 366], clearHeightsCm ?? [198]);

        db.ProductCategories.Add(category);
        db.ShelterModels.Add(model);
        await db.SaveChangesAsync();
        return category.Id;
    }

    // ── GET /api/v1/shelters ─────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_Anonymous_Returns200WithNonEmptyList()
    {
        await SeedShelterModelAsync("simple-liste", "cat-liste");

        var response = await _client.GetAsync("/api/v1/shelters");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<ShelterModelSummaryDto>>();
        body.Should().NotBeNull();
        body!.Select(m => m.Slug).Should().Contain("simple-liste");
    }

    [Fact]
    public async Task GetAll_WithCategoryFilter_ReturnsOnlyMatchingModels()
    {
        await SeedShelterModelAsync("filtre-inclus", "cat-filtre-inclus");
        await SeedShelterModelAsync("filtre-exclu", "cat-filtre-exclu");

        var response = await _client.GetAsync("/api/v1/shelters?category=cat-filtre-inclus");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<ShelterModelSummaryDto>>();
        var slugs = body!.Select(m => m.Slug).ToList();
        slugs.Should().Contain("filtre-inclus");
        slugs.Should().NotContain("filtre-exclu");
    }

    // ── GET /api/v1/shelters/{slug} ──────────────────────────────────────────

    [Fact]
    public async Task GetBySlug_ExistingModel_Returns200WithDimensionOptions()
    {
        var categoryId = await SeedShelterModelAsync(
            "detail-simple", "cat-detail",
            widthsCm: [335, 366], clearHeightsCm: [198, 244]);

        var response = await _client.GetAsync("/api/v1/shelters/detail-simple");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ShelterModelDetailDto>();
        dto!.Slug.Should().Be("detail-simple");
        // L-030/Minor 9.5 : le détail porte le CategoryId (Guid) pour que l'édition admin re-résolve
        // la catégorie PAR ID, pas par nom (Name n'a pas d'index unique).
        dto.CategoryId.Should().Be(categoryId);
        dto.CategoryName.Should().Be("Cat cat-detail");
        dto.WidthOptionsCm.Should().BeEquivalentTo(new[] { 335, 366 });
        dto.ClearHeightOptionsCm.Should().BeEquivalentTo(new[] { 198, 244 });
        dto.MinLengthCm.Should().Be(122);
        dto.MaxLengthCm.Should().Be(1830);
        dto.LengthStepCm.Should().Be(122);
    }

    [Fact]
    public async Task GetBySlug_UnknownSlug_Returns404WithProblemDetails()
    {
        var response = await _client.GetAsync("/api/v1/shelters/inexistant-xyz");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(404);
        problem.Title.Should().Be("Ressource introuvable");
    }

    // ── GET /api/v1/shelters/{slug}/price ────────────────────────────────────

    [Fact]
    public async Task GetPrice_BaseLength_Returns200WithZeroArches()
    {
        await SeedShelterModelAsync("prix-base", "cat-prix-base");

        // La route littérale {slug}/price prime sur {slug} : on obtient un prix (200), pas un détail.
        var response = await _client.GetAsync("/api/v1/shelters/prix-base/price?lengthCm=122");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ShelterPriceDto>();
        dto!.Slug.Should().Be("prix-base");
        dto.LengthCm.Should().Be(122);
        dto.ArchCount.Should().Be(0);
        dto.TotalPrice.Should().Be(349.00m);
    }

    [Fact]
    public async Task GetPrice_OutOfRangeLength_Returns422()
    {
        await SeedShelterModelAsync("prix-hors-plage", "cat-prix-hors-plage");

        // 2000 > MaxLengthCm (1830) → 422 (BusinessRuleException), jamais un 500.
        var response = await _client.GetAsync("/api/v1/shelters/prix-hors-plage/price?lengthCm=2000");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);
    }

    [Fact]
    public async Task GetPrice_UnknownSlug_Returns404()
    {
        var response = await _client.GetAsync("/api/v1/shelters/inexistant-xyz/price?lengthCm=122");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
