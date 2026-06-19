using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Microsoft.Extensions.Logging.Abstractions;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Persistence;

/// <summary>
/// Non-régression du seed/backfill du référentiel des modèles d'abris (EPIC 9.1).
/// Idempotent + par SLUG (L-031) : crée les modèles de référence absents, n'écrase JAMAIS un
/// modèle déjà présent (édition admin), et un 2e passage ne change rien (L-005). N'utilise que des
/// opérations EF compatibles InMemory (L-022).
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
    public async Task Seed_OnEmptyDb_CreatesTheFourReferenceModels()
    {
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        var models = await _db.ShelterModels.Include(m => m.Dimensions).ToListAsync();
        models.Should().HaveCount(4);
        models.Select(m => m.Slug).Should()
            .BeEquivalentTo("simple", "monopente", "double-pointu", "double-rond");

        // L'owned collection round-trip : un modèle a bien ses largeurs + hauteurs.
        var simple = models.Single(m => m.Slug == "simple");
        simple.WidthOptionsCm.Should().Equal(335, 366);
        simple.ClearHeightOptionsCm.Should().Equal(198);
        simple.BasePrice.Should().Be(349.00m);
    }

    [Fact]
    public async Task Seed_PreservesAdminEditedModel_NeverOverwrites()
    {
        // Un admin a déjà un modèle « simple » avec un prix de base personnalisé.
        var categoryId = _db.ProductCategories.Single(c => c.Slug == "abris-simples").Id;
        var adminModel = ShelterModel.Create(
            "simple", "Abri simple maison", categoryId,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            basePrice: 999.00m, pricePerArchCents: 20000,
            widthsCm: [400], clearHeightsCm: [200]);
        _db.ShelterModels.Add(adminModel);
        await _db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);

        // « simple » existait → jamais écrasé ; les 3 autres sont créés.
        var simple = await _db.ShelterModels.SingleAsync(m => m.Slug == "simple");
        simple.Name.Should().Be("Abri simple maison");  // valeur admin préservée
        simple.BasePrice.Should().Be(999.00m);          // valeur admin préservée
        (await _db.ShelterModels.CountAsync()).Should().Be(4);
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
        // 1 sur-mesure + 4 du référentiel.
        (await _db.ShelterModels.CountAsync()).Should().Be(5);
    }

    [Fact]
    public async Task Seed_IsIdempotent_SecondPassAddsNothing()
    {
        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var firstCount = await _db.ShelterModels.CountAsync();

        await ShelterModelSeeder.SeedAsync(_db, NullLogger.Instance);
        var secondCount = await _db.ShelterModels.CountAsync();

        firstCount.Should().Be(4);
        secondCount.Should().Be(4);  // 2e passage : aucun ajout.
    }

    [Fact]
    public async Task Seed_WithMissingCategory_SkipsThatModelWithoutThrowing()
    {
        // DB sans la catégorie « abris-doubles » : les modèles doubles sont ignorés proprement.
        using var db = TestDbContextFactory.Create();
        db.ProductCategories.Add(ProductCategory.Create("Abris simples", "abris-simples"));
        await db.SaveChangesAsync();

        await ShelterModelSeeder.SeedAsync(db, NullLogger.Instance);

        var slugs = await db.ShelterModels.Select(m => m.Slug).ToListAsync();
        slugs.Should().BeEquivalentTo("simple", "monopente"); // doubles ignorés (catégorie absente)
    }

    public void Dispose() => _db.Dispose();
}
