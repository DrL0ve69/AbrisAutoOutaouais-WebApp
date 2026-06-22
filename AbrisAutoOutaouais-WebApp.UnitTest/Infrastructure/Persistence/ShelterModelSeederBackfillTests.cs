using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Microsoft.Extensions.Logging.Abstractions;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Persistence;

/// <summary>
/// Non-régression du seed/backfill du référentiel des modèles d'abris + de leur GRILLE DE PRIX
/// EXACTE (chantier « grille de prix exacte »). Données chargées depuis la ressource embarquée
/// <c>shelter-price-grids.json</c> (9 modèles, dont le nouveau <c>simple-hd-11pi</c>). Idempotent +
/// par SLUG (L-031) : crée les modèles absents avec leur grille, n'écrase JAMAIS un modèle déjà
/// présent (édition admin), BACKFILLE la grille d'un modèle existant dont la grille est vide,
/// SOFT-DELETE les anciens modèles multi-largeurs, et un 2e passage ne change rien (L-005).
/// N'utilise que des opérations EF compatibles InMemory (L-022).
/// </summary>
public sealed class ShelterModelSeederBackfillTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    public ShelterModelSeederBackfillTests()
    {
        // Catégories requises par le rattachement des modèles (par slug), comme ProductSeeder.
        _db.ProductCategories.Add(ProductCategory.Create("Abris simples", "abris-simples"));
        _db.ProductCategories.Add(ProductCategory.Create("Abris doubles", "abris-doubles"));
        _db.SaveChanges();
    }

    [Fact]
    public async Task Seed_OnEmptyDb_CreatesTheNinePerWidthReferenceModelsWithGrids()
    {
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        var models = await _db.ShelterModels
            .Include(m => m.Dimensions)
            .Include(m => m.PriceEntries)
            .ToListAsync();
        models.Should().HaveCount(9);
        models.Select(m => m.Slug).Should().BeEquivalentTo(
            "simple-11pi", "simple-hd-11pi", "simple-12pi", "monopente",
            "double-pointu-16pi", "double-pointu-18pi", "double-pointu-20pi",
            "double-rond-18pi", "double-rond-20pi");

        // Rework EPIC 9 : un modèle = UNE largeur. Les enfants round-trip (.Include).
        var simple11 = models.Single(m => m.Slug == "simple-11pi");
        simple11.WidthOptionsCm.Should().Equal(335);
        simple11.ClearHeightOptionsCm.Should().Equal(198, 229, 259);
        simple11.MinLengthCm.Should().Be(122);
        // « À partir de » = min de la grille (122 × 198 = 34900 ¢).
        simple11.StartingPriceCents.Should().Be(34900);
        // Le prix dépend de la HAUTEUR : 122 × 229 = 47400 ¢, 122 × 259 = 74900 ¢.
        simple11.PriceFor(122, 198).Should().Be(34900);
        simple11.PriceFor(122, 229).Should().Be(47400);
        simple11.PriceFor(122, 259).Should().Be(74900);

        // La grille du double-rond est ÉPARSE : certaines combinaisons n'existent pas.
        var doubleRond = models.Single(m => m.Slug == "double-rond-18pi");
        doubleRond.PriceFor(457, 239).Should().Be(114900);
        doubleRond.PriceFor(457, 213).Should().BeNull();   // combinaison absente (grille éparse)

        // Tarif cohérent : 11 pi < 12 pi.
        simple11.StartingPriceCents.Should().BeLessThan(
            models.Single(m => m.Slug == "simple-12pi").StartingPriceCents!.Value);
    }

    [Fact]
    public async Task Seed_SoftDeletesLegacyMultiWidthModels_AndKeepsMonopente()
    {
        // On simule une base DÉJÀ semée avec les anciens modèles multi-largeurs + monopente.
        var simplesCat = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var doublesCat = _db.ProductCategories.Single(c => c.Slug == "abris-doubles").Id;

        _db.ShelterModels.Add(ShelterModelTestData.CreateWithGrid(
            "simple", "Abri simple — Abris Tempo", simplesCat,
            122, 122, 1830, 349.00m, 15000, [335], [198]));
        _db.ShelterModels.Add(ShelterModelTestData.CreateWithGrid(
            "double-pointu", "Abri double pointu — Abris Tempo", doublesCat,
            122, 122, 1342, 724.00m, 15000, [488], [198]));
        _db.ShelterModels.Add(ShelterModelTestData.CreateWithGrid(
            "double-rond", "Abri double rond — Abris Tempo", doublesCat,
            152, 457, 1065, 1149.00m, 15000, [549], [213]));
        // monopente (slug conservé) : créé avec d'anciennes bornes, NE doit PAS être touché.
        _db.ShelterModels.Add(ShelterModelTestData.CreateWithGrid(
            "monopente", "Abri monopente — Abris Tempo", simplesCat,
            122, 122, 1830, 874.00m, 15000, [320], [213]));
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        // Les anciens slugs multi-largeurs sont soft-deletés (absents des queries filtrées).
        var visibleSlugs = await _db.ShelterModels.Select(m => m.Slug).ToListAsync();
        visibleSlugs.Should().NotContain("simple");
        visibleSlugs.Should().NotContain("double-pointu");
        visibleSlugs.Should().NotContain("double-rond");

        // Mais bien présents et marqués IsDeleted dans le store (en ignorant les filtres).
        var legacy = await _db.ShelterModels
            .IgnoreQueryFilters()
            .Where(m => m.Slug == "simple" || m.Slug == "double-pointu" || m.Slug == "double-rond")
            .ToListAsync();
        legacy.Should().HaveCount(3);
        legacy.Should().OnlyContain(m => m.IsDeleted);

        // monopente CONSERVÉ et NON écrasé (édition admin préservée — L-031).
        var monopente = await _db.ShelterModels
            .Include(m => m.PriceEntries)
            .SingleAsync(m => m.Slug == "monopente");
        monopente.IsDeleted.Should().BeFalse();
        monopente.StartingPriceCents.Should().Be(87400);  // grille d'origine préservée (jamais réécrite)
        monopente.MinLengthCm.Should().Be(122);           // bornes d'origine préservées
    }

    [Fact]
    public async Task Seed_PreservesAdminEditedModel_NeverOverwrites()
    {
        // Un admin a déjà un modèle « simple-11pi » avec une grille personnalisée.
        var categoryId = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var adminModel = ShelterModelTestData.CreateWithGrid(
            "simple-11pi", "Abri simple maison", categoryId,
            lengthStepCm: 122, minLengthCm: 488, maxLengthCm: 1830,
            basePrice: 999.00m, pricePerArchCents: 20000,
            widthsCm: [400], clearHeightsCm: [200]);
        _db.ShelterModels.Add(adminModel);
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        // « simple-11pi » existait → jamais écrasé ; les 8 autres sont créés.
        var simple = await _db.ShelterModels
            .Include(m => m.PriceEntries)
            .SingleAsync(m => m.Slug == "simple-11pi");
        simple.Name.Should().Be("Abri simple maison");  // valeur admin préservée
        simple.StartingPriceCents.Should().Be(99900);   // grille admin préservée (999 $), pas backfillée
        (await _db.ShelterModels.CountAsync()).Should().Be(9);
    }

    [Fact]
    public async Task Seed_BackfillsEmptyGridOfExistingModel_WithoutOverwritingScalars()
    {
        // Une base semée AVANT l'introduction de la grille : « simple-11pi » présent SANS grille.
        var categoryId = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var modelSansGrille = ShelterModel.Create(
            "simple-11pi", "Abri simple maison", categoryId,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1342,
            widthsCm: [400], clearHeightsCm: [198]);   // priceEntries omis → grille vide
        _db.ShelterModels.Add(modelSansGrille);
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        var simple = await _db.ShelterModels
            .Include(m => m.PriceEntries)
            .SingleAsync(m => m.Slug == "simple-11pi");
        // La grille a été BACKFILLÉE depuis le référentiel…
        simple.PriceEntries.Should().NotBeEmpty();
        simple.PriceFor(122, 198).Should().Be(34900);
        // …mais les champs admin (nom, bornes, largeur) NE sont PAS écrasés (L-031).
        simple.Name.Should().Be("Abri simple maison");
        simple.MaxLengthCm.Should().Be(1342);
        simple.WidthOptionsCm.Should().Equal(400);
    }

    [Fact]
    public async Task Seed_LeavesUnknownSlugUntouched()
    {
        // Un modèle hors référentiel (créé par un admin) n'est jamais modifié ni supprimé.
        var categoryId = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var custom = ShelterModelTestData.CreateWithGrid(
            "modele-sur-mesure", "Modèle sur mesure", categoryId,
            lengthStepCm: 100, minLengthCm: 200, maxLengthCm: 600,
            basePrice: 555.00m, pricePerArchCents: 10000,
            widthsCm: [300], clearHeightsCm: [250]);
        _db.ShelterModels.Add(custom);
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        var unchanged = await _db.ShelterModels
            .Include(m => m.PriceEntries)
            .SingleAsync(m => m.Slug == "modele-sur-mesure");
        unchanged.StartingPriceCents.Should().Be(55500);
        unchanged.Name.Should().Be("Modèle sur mesure");
        // 1 sur-mesure + 9 du référentiel.
        (await _db.ShelterModels.CountAsync()).Should().Be(10);
    }

    [Fact]
    public async Task Seed_IsIdempotent_SecondPassChangesNothing()
    {
        // 1er passage : sème les 9 nouveaux (rien d'ancien à retirer).
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var firstSlugs = await _db.ShelterModels
            .IgnoreQueryFilters()
            .Select(m => new { m.Slug, m.IsDeleted })
            .ToListAsync();

        // 2e passage : aucun ajout, aucun nouveau soft-delete, aucun backfill.
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var secondSlugs = await _db.ShelterModels
            .IgnoreQueryFilters()
            .Select(m => new { m.Slug, m.IsDeleted })
            .ToListAsync();

        firstSlugs.Should().HaveCount(9);
        secondSlugs.Should().BeEquivalentTo(firstSlugs);  // état strictement identique.
    }

    [Fact]
    public async Task Seed_LegacyRemoval_IsIdempotent_NoReDeleteOnSecondPass()
    {
        // Un ancien modèle multi-largeurs présent → soft-deleté au 1er passage, inchangé au 2e.
        var simplesCat = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var legacy = ShelterModelTestData.CreateWithGrid(
            "simple", "Abri simple — Abris Tempo", simplesCat,
            122, 122, 1830, 349.00m, 15000, [335], [198]);
        _db.ShelterModels.Add(legacy);
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var afterFirst = await _db.ShelterModels
            .IgnoreQueryFilters()
            .SingleAsync(m => m.Slug == "simple");
        afterFirst.IsDeleted.Should().BeTrue();
        var deletedAt = afterFirst.DeletedAt;

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var afterSecond = await _db.ShelterModels
            .IgnoreQueryFilters()
            .SingleAsync(m => m.Slug == "simple");
        // 2e passage : NON re-supprimé (DeletedAt inchangé → on ne touche que les actifs).
        afterSecond.DeletedAt.Should().Be(deletedAt);
    }

    [Fact]
    public async Task Seed_WithMissingCategory_SkipsThoseModelsWithoutThrowing()
    {
        // DB sans la catégorie « abris-doubles » : les modèles doubles sont ignorés proprement.
        using var db = TestDbContextFactory.Create();
        db.ProductCategories.Add(ProductCategory.Create("Abris simples", "abris-simples"));
        await db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(db, NullLogger.Instance);

        var slugs = await db.ShelterModels.Select(m => m.Slug).ToListAsync();
        // Seuls les modèles « abris-simples » sont semés (doubles ignorés, catégorie absente).
        slugs.Should().BeEquivalentTo("simple-11pi", "simple-hd-11pi", "simple-12pi", "monopente");
    }

    /// <summary>
    /// Test-garde de l'invariant de domaine <c>(Max - Min) % Step == 0</c> pour CHAQUE spec, de la
    /// règle « une largeur = un modèle », et de « grille non vide » (chaque modèle de référence est
    /// tarifé). Échoue si une future spec viole l'invariant — bien avant un crash au seed.
    /// </summary>
    [Fact]
    public void Specs_AllSatisfyLengthInvariant_HaveOneWidth_AndANonEmptyGrid()
    {
        foreach (var spec in ShelterModelSeeder.SpecInvariants)
        {
            ((spec.MaxLengthCm - spec.MinLengthCm) % spec.LengthStepCm)
                .Should().Be(0, "le modèle « {0} » doit avoir une plage multiple du pas", spec.Slug);
            spec.MinLengthCm.Should().BeLessThan(spec.MaxLengthCm);
            spec.MinLengthCm.Should().BeGreaterThan(0);
            spec.WidthCount.Should().Be(1, "le modèle « {0} » ne doit exposer QU'UNE largeur (rework EPIC 9)", spec.Slug);
            spec.PriceEntryCount.Should().BeGreaterThan(0, "le modèle « {0} » doit avoir une grille de prix", spec.Slug);
        }
    }

    [Fact]
    public void Specs_DoNotReuseAnyLegacyMultiWidthSlug()
    {
        // Les nouveaux slugs par-largeur ne doivent jamais réutiliser un ancien slug retiré
        // (sinon on créerait un modèle qu'on retire dans le même passage).
        ShelterModelSeeder.SeededSlugs.Should().NotIntersectWith(ShelterModelSeeder.LegacySlugs);
        ShelterModelSeeder.LegacySlugs.Should().BeEquivalentTo(
            new[] { "simple", "double-pointu", "double-rond" });
        // monopente est CONSERVÉ : il ne fait pas partie des slugs retirés.
        ShelterModelSeeder.LegacySlugs.Should().NotContain("monopente");
    }

    public void Dispose() => _db.Dispose();
}
