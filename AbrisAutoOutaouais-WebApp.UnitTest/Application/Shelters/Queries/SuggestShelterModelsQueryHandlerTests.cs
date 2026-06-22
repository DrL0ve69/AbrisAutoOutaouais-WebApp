using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.SuggestShelterModels;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Shelters.Queries;

/// <summary>
/// Couvre la forme groupée par catégorie, le tri déterministe (catégorie nom/slug ; modèle
/// largeur/slug), le bornage des longueurs (mesure, max modèle, plafond 40 pi) et l'exclusion des
/// modèles trop larges. Sème le référentiel réel EPIC 9 sur un <c>ApplicationDbContext</c> InMemory.
/// Cas de validation : 914×1219 (tous les modèles ≤ 914) et 488×914 (seuls les ≤ 488).
/// </summary>
public sealed class SuggestShelterModelsQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ProductCategory _simples = ProductCategory.Create("Abris simples", "abris-simples");
    private readonly ProductCategory _doubles = ProductCategory.Create("Abris doubles", "abris-doubles");

    public SuggestShelterModelsQueryHandlerTests()
    {
        _db.ProductCategories.AddRange(_simples, _doubles);
        _db.SaveChanges();
        SeedReferential();
    }

    /// <summary>Sème les 8 modèles du référentiel EPIC 9 (mêmes largeurs/bornes que le seeder).</summary>
    private void SeedReferential()
    {
        void Add(string slug, Guid categoryId, int width, int step, int min, int max)
            => _db.ShelterModels.Add(ShelterModelTestData.CreateWithGrid(
                slug, $"Modèle {slug}", categoryId, step, min, max,
                basePrice: 999.00m, pricePerArchCents: 15000,
                widthsCm: [width], clearHeightsCm: [198]));

        Add("simple-11pi", _simples.Id, 335, 122, 488, 1830);
        Add("simple-12pi", _simples.Id, 366, 122, 488, 1830);
        Add("monopente", _simples.Id, 320, 122, 488, 1830);
        Add("double-pointu-16pi", _doubles.Id, 488, 122, 488, 1342);
        Add("double-pointu-18pi", _doubles.Id, 549, 122, 488, 1342);
        Add("double-pointu-20pi", _doubles.Id, 610, 122, 488, 1342);
        Add("double-rond-18pi", _doubles.Id, 549, 152, 457, 1065);
        Add("double-rond-20pi", _doubles.Id, 610, 152, 457, 1065);
        _db.SaveChanges();
    }

    private SuggestShelterModelsQueryHandler Handler => new(_db);

    [Fact]
    public async Task Handle_914x1219_ReturnsBothCategoriesAllModels()
    {
        var result = await Handler.Handle(
            new SuggestShelterModelsQuery(914, 1219), CancellationToken.None);

        // Tri catégorie par NOM : « Abris doubles » < « Abris simples ».
        result.Select(r => r.CategorySlug).Should()
            .ContainInOrder("abris-doubles", "abris-simples");

        var simples = result.Single(r => r.CategorySlug == "abris-simples");
        simples.Models.Select(m => m.Slug).Should()
            .Equal("monopente", "simple-11pi", "simple-12pi"); // tri largeur 320<335<366
        simples.CategoryMaxWidthCm.Should().Be(366);

        var doubles = result.Single(r => r.CategorySlug == "abris-doubles");
        // Tous les modèles doubles ont largeur ≤ 914 → tous retenus, triés largeur puis slug.
        doubles.Models.Select(m => m.Slug).Should().Equal(
            "double-pointu-16pi",                   // 488
            "double-pointu-18pi", "double-rond-18pi", // 549 — tie-break slug
            "double-pointu-20pi", "double-rond-20pi"); // 610 — tie-break slug
        doubles.CategoryMaxWidthCm.Should().Be(610);
    }

    [Fact]
    public async Task Handle_488x914_ReturnsOnlyModelsAtOrUnder488()
    {
        var result = await Handler.Handle(
            new SuggestShelterModelsQuery(488, 914), CancellationToken.None);

        var simples = result.Single(r => r.CategorySlug == "abris-simples");
        simples.Models.Select(m => m.Slug).Should()
            .Equal("monopente", "simple-11pi", "simple-12pi");

        var doubles = result.Single(r => r.CategorySlug == "abris-doubles");
        // Seul double-pointu-16pi (488) ≤ 488 ; 18/20pi (549,610) et double-rond (549,610) exclus.
        doubles.Models.Select(m => m.Slug).Should().Equal("double-pointu-16pi");
    }

    [Fact]
    public async Task Handle_LengthsBoundedByRequiredLength()
    {
        var result = await Handler.Handle(
            new SuggestShelterModelsQuery(488, 914), CancellationToken.None);

        var monopente = result
            .SelectMany(r => r.Models)
            .Single(m => m.Slug == "monopente");

        // Min 488, pas 122 → 488, 610, 732, 854 (≤914) ; 976 > 914 exclu.
        monopente.AvailableLengthsCm.Should().Equal(488, 610, 732, 854);
    }

    [Fact]
    public async Task Handle_LengthsCappedAt40Feet_1219()
    {
        var result = await Handler.Handle(
            new SuggestShelterModelsQuery(914, 2000), CancellationToken.None);

        var lengths = result
            .SelectMany(r => r.Models)
            .Single(m => m.Slug == "simple-11pi")
            .AvailableLengthsCm;

        lengths.Should().OnlyContain(l => l <= ShelterFit.MaxSuggestedLengthCm);
        lengths.Last().Should().Be(1098); // 488 + 5×122 = 1098 ≤ 1219 ; 1220 exclu.
    }

    [Fact]
    public async Task Handle_WidthTooSmallForAnyModel_ReturnsEmpty()
    {
        var result = await Handler.Handle(
            new SuggestShelterModelsQuery(200, 1219), CancellationToken.None);

        result.Should().BeEmpty();
    }

    public void Dispose() => _db.Dispose();
}
