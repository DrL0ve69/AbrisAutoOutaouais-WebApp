using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Microsoft.Extensions.Logging.Abstractions;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Persistence;

/// <summary>
/// Non-régression du seed/backfill du référentiel des modèles d'abris (EPIC 9, rework par largeur).
/// Idempotent + par SLUG (L-031) : crée les modèles de référence absents, n'écrase JAMAIS un
/// modèle déjà présent (édition admin), SOFT-DELETE les anciens modèles multi-largeurs, et un 2e
/// passage ne change rien (L-005). N'utilise que des opérations EF compatibles InMemory (L-022).
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
    public async Task Seed_OnEmptyDb_CreatesTheEightPerWidthReferenceModels()
    {
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        var models = await _db.ShelterModels.Include(m => m.Dimensions).ToListAsync();
        models.Should().HaveCount(8);
        models.Select(m => m.Slug).Should().BeEquivalentTo(
            "simple-11pi", "simple-12pi", "monopente",
            "double-pointu-16pi", "double-pointu-18pi", "double-pointu-20pi",
            "double-rond-18pi", "double-rond-20pi");

        // Rework EPIC 9 : un modèle = UNE largeur. Les enfants round-trip (.Include).
        var simple11 = models.Single(m => m.Slug == "simple-11pi");
        simple11.WidthOptionsCm.Should().Equal(335);
        simple11.ClearHeightOptionsCm.Should().Equal(198);
        simple11.BasePrice.Should().Be(1099.00m);
        simple11.MinLengthCm.Should().Be(488);

        var simple12 = models.Single(m => m.Slug == "simple-12pi");
        simple12.WidthOptionsCm.Should().Equal(366);
        simple12.BasePrice.Should().Be(1249.00m);

        // Tarif cohérent : 11 pi < 12 pi < double.
        simple11.BasePrice.Should().BeLessThan(simple12.BasePrice);
        simple12.BasePrice.Should().BeLessThan(
            models.Single(m => m.Slug == "double-pointu-16pi").BasePrice);
    }

    [Fact]
    public async Task Seed_SoftDeletesLegacyMultiWidthModels_AndKeepsMonopente()
    {
        // On simule une base DÉJÀ semée avec les anciens modèles multi-largeurs + monopente.
        var simplesCat = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var doublesCat = _db.ProductCategories.Single(c => c.Slug == "abris-doubles").Id;

        _db.ShelterModels.Add(ShelterModel.Create(
            "simple", "Abri simple — Abris Tempo", simplesCat,
            122, 122, 1830, 349.00m, 15000, [335, 366], [198]));
        _db.ShelterModels.Add(ShelterModel.Create(
            "double-pointu", "Abri double pointu — Abris Tempo", doublesCat,
            122, 122, 1342, 724.00m, 15000, [488, 549, 610], [198, 229, 259, 290]));
        _db.ShelterModels.Add(ShelterModel.Create(
            "double-rond", "Abri double rond — Abris Tempo", doublesCat,
            152, 457, 1065, 1149.00m, 15000, [549, 610], [213, 239]));
        // monopente (slug conservé) : créé avec d'anciennes bornes, NE doit PAS être touché.
        _db.ShelterModels.Add(ShelterModel.Create(
            "monopente", "Abri monopente — Abris Tempo", simplesCat,
            122, 122, 1830, 874.00m, 15000, [320], [213, 244, 274]));
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
        var monopente = await _db.ShelterModels.SingleAsync(m => m.Slug == "monopente");
        monopente.IsDeleted.Should().BeFalse();
        monopente.BasePrice.Should().Be(874.00m);  // valeur d'origine préservée (jamais réécrite)
        monopente.MinLengthCm.Should().Be(122);    // bornes d'origine préservées
    }

    [Fact]
    public async Task Seed_PreservesAdminEditedModel_NeverOverwrites()
    {
        // Un admin a déjà un modèle « simple-11pi » avec un prix de base personnalisé.
        var categoryId = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var adminModel = ShelterModel.Create(
            "simple-11pi", "Abri simple maison", categoryId,
            lengthStepCm: 122, minLengthCm: 488, maxLengthCm: 1830,
            basePrice: 999.00m, pricePerArchCents: 20000,
            widthsCm: [400], clearHeightsCm: [200]);
        _db.ShelterModels.Add(adminModel);
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        // « simple-11pi » existait → jamais écrasé ; les 7 autres sont créés.
        var simple = await _db.ShelterModels.SingleAsync(m => m.Slug == "simple-11pi");
        simple.Name.Should().Be("Abri simple maison");  // valeur admin préservée
        simple.BasePrice.Should().Be(999.00m);          // valeur admin préservée
        (await _db.ShelterModels.CountAsync()).Should().Be(8);
    }

    [Fact]
    public async Task Seed_LeavesUnknownSlugUntouched()
    {
        // Un modèle hors référentiel (créé par un admin) n'est jamais modifié ni supprimé.
        var categoryId = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var custom = ShelterModel.Create(
            "modele-sur-mesure", "Modèle sur mesure", categoryId,
            lengthStepCm: 100, minLengthCm: 200, maxLengthCm: 600,
            basePrice: 555.00m, pricePerArchCents: 10000,
            widthsCm: [300], clearHeightsCm: [250]);
        _db.ShelterModels.Add(custom);
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        var unchanged = await _db.ShelterModels.SingleAsync(m => m.Slug == "modele-sur-mesure");
        unchanged.BasePrice.Should().Be(555.00m);
        unchanged.Name.Should().Be("Modèle sur mesure");
        // 1 sur-mesure + 8 du référentiel.
        (await _db.ShelterModels.CountAsync()).Should().Be(9);
    }

    [Fact]
    public async Task Seed_IsIdempotent_SecondPassChangesNothing()
    {
        // 1er passage : sème les 8 nouveaux + (ici rien d'ancien à retirer).
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var firstSlugs = await _db.ShelterModels
            .IgnoreQueryFilters()
            .Select(m => new { m.Slug, m.IsDeleted })
            .ToListAsync();

        // 2e passage : aucun ajout, aucun nouveau soft-delete.
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var secondSlugs = await _db.ShelterModels
            .IgnoreQueryFilters()
            .Select(m => new { m.Slug, m.IsDeleted })
            .ToListAsync();

        firstSlugs.Should().HaveCount(8);
        secondSlugs.Should().BeEquivalentTo(firstSlugs);  // état strictement identique.
    }

    [Fact]
    public async Task Seed_LegacyRemoval_IsIdempotent_NoReDeleteOnSecondPass()
    {
        // Un ancien modèle multi-largeurs présent → soft-deleté au 1er passage, inchangé au 2e.
        var simplesCat = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var legacy = ShelterModel.Create(
            "simple", "Abri simple — Abris Tempo", simplesCat,
            122, 122, 1830, 349.00m, 15000, [335, 366], [198]);
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
        slugs.Should().BeEquivalentTo("simple-11pi", "simple-12pi", "monopente");
    }

    /// <summary>
    /// Test-garde de l'invariant de domaine <c>(Max - Min) % Step == 0</c> pour CHAQUE spec, et de la
    /// règle du rework « une largeur = un modèle » (exactement une largeur par spec). Échoue à la
    /// compilation/exécution si une future spec viole l'invariant — bien avant un crash au seed.
    /// </summary>
    [Fact]
    public void Specs_AllSatisfyLengthInvariant_AndHaveExactlyOneWidth()
    {
        foreach (var spec in ShelterModelSeeder.SpecInvariants)
        {
            ((spec.MaxLengthCm - spec.MinLengthCm) % spec.LengthStepCm)
                .Should().Be(0, "le modèle « {0} » doit avoir une plage multiple du pas", spec.Slug);
            spec.MinLengthCm.Should().BeLessThan(spec.MaxLengthCm);
            spec.MinLengthCm.Should().BeGreaterThan(0);
            spec.WidthCount.Should().Be(1, "le modèle « {0} » ne doit exposer QU'UNE largeur (rework EPIC 9)", spec.Slug);
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
