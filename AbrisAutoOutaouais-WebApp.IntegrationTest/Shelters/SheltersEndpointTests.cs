using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModels;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.SuggestShelterModels;
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
        var heights = clearHeightsCm ?? [198];
        var model = ShelterModel.Create(
            slug, $"Modèle {slug}", category.Id,
            lengthStepCm, minLengthCm, maxLengthCm,
            widthsCm ?? [335, 366], heights,
            BuildGrid(minLengthCm, maxLengthCm, lengthStepCm, basePrice, pricePerArchCents, heights));

        db.ProductCategories.Add(category);
        db.ShelterModels.Add(model);
        await db.SaveChangesAsync();
        return category.Id;
    }

    /// <summary>
    /// Construit une grille de prix COMPLÈTE (longueur × hauteur sur [min, max] par pas) dont le prix
    /// réplique l'ancienne formule par arches — pour que les assertions de prix héritées (base, +N
    /// arches) restent valides via le LOOKUP. Prix indépendant de la hauteur (suffisant ici).
    /// </summary>
    private static List<ShelterModel.PriceEntryInput> BuildGrid(
        int minLengthCm, int maxLengthCm, int lengthStepCm,
        decimal basePrice, int pricePerArchCents, IReadOnlyList<int> heights)
    {
        var entries = new List<ShelterModel.PriceEntryInput>();
        for (var length = minLengthCm; length <= maxLengthCm; length += lengthStepCm)
        {
            var arches = (length - minLengthCm) / lengthStepCm;
            var priceCents = (int)(basePrice * 100) + arches * pricePerArchCents;
            foreach (var h in heights)
                entries.Add(new ShelterModel.PriceEntryInput(length, h, priceCents));
        }
        return entries;
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
        var seeded = body!.Single(m => m.Slug == "simple-liste");
        // BasePrice = « à partir de » = MIN de la grille (projection corrélée). On l'assert
        // explicitement : sinon un Include/projection qui ressort 0 passerait inaperçu (L-009/L-035).
        seeded.BasePrice.Should().Be(349.00m);
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

        // Le détail expose la GRILLE DE PRIX complète (calcul optimiste du configurateur) et le « à
        // partir de » = min de la grille. Grille seedée par BuildGrid (deux hauteurs × longueurs).
        dto.PriceGrid.Should().NotBeEmpty();
        dto.PriceGrid.Should().Contain(e => e.LengthCm == 122 && e.ClearHeightCm == 198 && e.PriceCents == 34900);
        dto.BasePrice.Should().Be(349.00m);   // min de la grille (34900 ¢)
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
    public async Task GetPrice_BaseLength_Returns200WithGridPrice()
    {
        await SeedShelterModelAsync("prix-base", "cat-prix-base");

        // La route littérale {slug}/price prime sur {slug} : on obtient un prix (200), pas un détail.
        var response = await _client.GetAsync(
            "/api/v1/shelters/prix-base/price?lengthCm=122&clearHeightCm=198");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ShelterPriceDto>();
        dto!.Slug.Should().Be("prix-base");
        dto.LengthCm.Should().Be(122);
        dto.ClearHeightCm.Should().Be(198);
        dto.TotalPrice.Should().Be(349.00m);
    }

    [Fact]
    public async Task GetPrice_CombinationAbsentFromGrid_Returns422()
    {
        await SeedShelterModelAsync("prix-hors-plage", "cat-prix-hors-plage");

        // 2000 cm n'a aucune entrée dans la grille → 422 (BusinessRuleException), jamais un 500.
        var response = await _client.GetAsync(
            "/api/v1/shelters/prix-hors-plage/price?lengthCm=2000&clearHeightCm=198");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);
    }

    [Fact]
    public async Task GetPrice_UnknownSlug_Returns404()
    {
        var response = await _client.GetAsync(
            "/api/v1/shelters/inexistant-xyz/price?lengthCm=122&clearHeightCm=198");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── GET /api/v1/shelters/suggest ─────────────────────────────────────────

    [Fact]
    public async Task GetSuggestions_Anonymous_Returns200GroupedByCategory()
    {
        // Deux modèles d'une même catégorie, largeurs ≤ 914 → tous deux retenus, agrégés.
        var categoryId = await SeedShelterModelAsync(
            "suggest-etroit", "cat-suggest", widthsCm: [335],
            minLengthCm: 488, maxLengthCm: 1830);
        await SeedShelterModelInCategoryAsync("suggest-large", categoryId, width: 488);

        // La route littérale « suggest » prime sur {slug} : on obtient une LISTE (200), pas un 404.
        var response = await _client.GetAsync(
            "/api/v1/shelters/suggest?requiredWidthCm=914&requiredLengthCm=1219");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<ShelterFitResultDto>>();
        body.Should().NotBeNull();

        var cat = body!.Single(r => r.CategorySlug == "cat-suggest");
        cat.Models.Select(m => m.Slug).Should().Contain(["suggest-etroit", "suggest-large"]);
        cat.CategoryMaxWidthCm.Should().Be(488);
        // Bornage par le plafond métier 40 pi : aucune longueur > 1219.
        cat.Models.SelectMany(m => m.AvailableLengthsCm).Should().OnlyContain(l => l <= 1219);
    }

    [Fact]
    public async Task GetSuggestions_ExcludesModelsTooWide()
    {
        await SeedShelterModelAsync(
            "suggest-trop-large", "cat-trop-large", widthsCm: [610],
            minLengthCm: 488, maxLengthCm: 1342);

        // Largeur requise 488 < largeur modèle 610 → exclu.
        var response = await _client.GetAsync(
            "/api/v1/shelters/suggest?requiredWidthCm=488&requiredLengthCm=914");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<ShelterFitResultDto>>();
        body!.Should().NotContain(r => r.CategorySlug == "cat-trop-large");
    }

    [Fact]
    public async Task GetSuggestions_WithInvalidRequired_Returns422()
    {
        var response = await _client.GetAsync(
            "/api/v1/shelters/suggest?requiredWidthCm=0&requiredLengthCm=400");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);
    }

    /// <summary>
    /// Filet « sibling-action » (L-028) : ouvrir GET /suggest en <c>[AllowAnonymous]</c> n'a PAS
    /// élargi l'auth des actions protégées du MÊME contrôleur. Contraste direct avec
    /// <see cref="GetSuggestions_Anonymous_Returns200GroupedByCategory"/> : un appel anonyme à
    /// l'action AdminOnly POST /api/v1/shelters (création de ShelterModel) reste refusé en 401.
    /// L'auth coupe AVANT la liaison de modèle, donc un corps vide suffit (le 401 précède la
    /// validation). Verrouille le second volet de la revue L-028 (couverture des actions voisines).
    /// </summary>
    [Fact]
    public async Task CreateShelterModel_Anonymous_StillReturns401_SiblingActionUnaffected()
    {
        // Aucun JWT : l'en-tête Authorization est nul (réinitialisé au ctor).
        var response = await _client.PostAsJsonAsync("/api/v1/shelters", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    /// <summary>Ajoute un modèle dans une catégorie DÉJÀ semée (slug unique, une seule largeur).</summary>
    private async Task SeedShelterModelInCategoryAsync(string slug, Guid categoryId, int width)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var model = ShelterModel.Create(
            slug, $"Modèle {slug}", categoryId,
            lengthStepCm: 122, minLengthCm: 488, maxLengthCm: 1830,
            widthsCm: [width], clearHeightsCm: [198],
            priceEntries: BuildGrid(488, 1830, 122, 349.00m, 15000, [198]));
        db.ShelterModels.Add(model);
        await db.SaveChangesAsync();
    }
}
