using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Microsoft.Extensions.Logging.Abstractions;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Persistence;

/// <summary>
/// Non-régression du BACKFILL du catalogue (G3) : un DB déjà semé AVANT D1/G1 porte des abris
/// connus aux WidthCm/Brand NULL → « suggest-shelters » revenait vide. <c>BackfillShelterDataAsync</c>
/// renseigne ces champs par slug. Ce test est le garde-fou CI que la revue exigeait (L-005) ; il
/// verrouille aussi l'invariant « n'écrase JAMAIS une donnée saisie par un admin » (par champ).
/// </summary>
public sealed class ProductSeederBackfillTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ProductCategory _category = ProductCategory.Create("Abris simples", "abris-simples");

    public ProductSeederBackfillTests()
    {
        _db.ProductCategories.Add(_category);
        _db.SaveChanges();
    }

    private Product Seed(string slug, int? widthCm = null, int? lengthCm = null, int? heightCm = null,
        string? brand = null, string? model = null)
    {
        var product = Product.Create(
            "Abri " + slug, slug, 199m, 5, _category.Id,
            widthCm: widthCm, lengthCm: lengthCm, heightCm: heightCm, brand: brand, model: model);
        _db.Products.Add(product);
        _db.SaveChanges();
        return product;
    }

    [Fact]
    public async Task Backfill_KnownShelterWithNullDims_FillsDimensionsAndBrandModel()
    {
        // Abri connu (slug du seeder) semé « périmé » : dims + marque/modèle NULL.
        var p = Seed("abri-simple-une-voiture");

        await ProductSeeder.BackfillShelterDataAsync(_db, NullLogger.Instance);

        await _db.Entry(p).ReloadAsync();
        p.WidthCm.Should().Be(335);
        p.LengthCm.Should().Be(488);
        p.HeightCm.Should().Be(244);
        p.Brand.Should().Be("Abris Tempo");
        p.Model.Should().Be("Tempo Auto 11x16");
    }

    [Fact]
    public async Task Backfill_SmallShelterWithNullDims_FillsBrandModelOnly()
    {
        // Petit abri (sans dimensions publiées) : seuls marque/modèle sont renseignés.
        var p = Seed("abri-entree");

        await ProductSeeder.BackfillShelterDataAsync(_db, NullLogger.Instance);

        await _db.Entry(p).ReloadAsync();
        p.WidthCm.Should().BeNull();
        p.LengthCm.Should().BeNull();
        p.Brand.Should().Be("Abris Tempo");
        p.Model.Should().Be("Tempo Entrée");
    }

    [Fact]
    public async Task Backfill_PreservesAdminEditedFields_NeverOverwrites()
    {
        // Un admin a saisi une LARGEUR et une MARQUE personnalisées, laissé la longueur/le modèle NULL.
        // Le backfill ne doit compléter QUE les champs vides — jamais écraser la saisie admin.
        var p = Seed("abri-simple-une-voiture", widthCm: 999, brand: "Marque Maison");

        await ProductSeeder.BackfillShelterDataAsync(_db, NullLogger.Instance);

        await _db.Entry(p).ReloadAsync();
        p.WidthCm.Should().Be(999);            // valeur admin préservée
        p.Brand.Should().Be("Marque Maison");  // valeur admin préservée
        p.LengthCm.Should().Be(488);           // champ vide complété
        p.HeightCm.Should().Be(244);           // champ vide complété
        p.Model.Should().Be("Tempo Auto 11x16"); // champ vide complété
    }

    [Fact]
    public async Task Backfill_PreservesAdminModel_FillsOnlyMissingBrand()
    {
        // Branche miroir : un admin a saisi le MODÈLE, laissé la marque NULL. Seule la marque
        // doit être complétée — le modèle admin est préservé (FillBrandModel, par champ).
        var p = Seed("abri-simple-une-voiture", model: "Modèle Maison");

        await ProductSeeder.BackfillShelterDataAsync(_db, NullLogger.Instance);

        await _db.Entry(p).ReloadAsync();
        p.Model.Should().Be("Modèle Maison");  // valeur admin préservée
        p.Brand.Should().Be("Abris Tempo");    // champ vide complété
    }

    [Fact]
    public async Task Backfill_UnknownSlug_IsLeftUntouched()
    {
        // Produit hors catalogue connu (créé par un admin) : jamais touché.
        var p = Seed("produit-admin-inconnu");

        await ProductSeeder.BackfillShelterDataAsync(_db, NullLogger.Instance);

        await _db.Entry(p).ReloadAsync();
        p.WidthCm.Should().BeNull();
        p.Brand.Should().BeNull();
        p.Model.Should().BeNull();
    }

    [Fact]
    public async Task Backfill_IsIdempotent_SecondPassChangesNothing()
    {
        var p = Seed("abri-simple-une-voiture");
        await ProductSeeder.BackfillShelterDataAsync(_db, NullLogger.Instance);
        await _db.Entry(p).ReloadAsync();
        var firstUpdatedAt = p.UpdatedAt;

        // 2e passage : tout est déjà rempli → aucune écriture.
        await ProductSeeder.BackfillShelterDataAsync(_db, NullLogger.Instance);
        await _db.Entry(p).ReloadAsync();

        p.WidthCm.Should().Be(335);
        p.UpdatedAt.Should().Be(firstUpdatedAt); // pas de SaveChanges → audit inchangé
    }

    // ── EnsureCategoriesAsync (upsert idempotent des catégories par slug) ────────

    [Fact]
    public async Task EnsureCategories_OnDbMissingMonopente_AddsItWithoutDuplicatingExisting()
    {
        // Le ctor a déjà semé « abris-simples ». La catégorie « abris-monopente » (ajoutée plus tard)
        // doit être créée sur un DB existant — c'est précisément le trou que comblent l'upsert (L-031).
        (await _db.ProductCategories.AnyAsync(c => c.Slug == "abris-monopente")).Should().BeFalse();

        await ProductSeeder.EnsureCategoriesAsync(_db, NullLogger.Instance);

        (await _db.ProductCategories.CountAsync(c => c.Slug == "abris-monopente")).Should().Be(1);
        // « abris-simples » préexistant : jamais dupliqué.
        (await _db.ProductCategories.CountAsync(c => c.Slug == "abris-simples")).Should().Be(1);
        // Le référentiel complet est présent (8 catégories).
        (await _db.ProductCategories.CountAsync()).Should().Be(8);
    }

    [Fact]
    public async Task EnsureCategories_IsIdempotent_SecondPassAddsNothing()
    {
        await ProductSeeder.EnsureCategoriesAsync(_db, NullLogger.Instance);
        var afterFirst = await _db.ProductCategories.CountAsync();

        await ProductSeeder.EnsureCategoriesAsync(_db, NullLogger.Instance);
        var afterSecond = await _db.ProductCategories.CountAsync();

        afterFirst.Should().Be(8);
        afterSecond.Should().Be(afterFirst);  // aucun doublon au 2e passage.
    }

    public void Dispose() => _db.Dispose();
}
