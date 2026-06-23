using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Persistence;

/// <summary>
/// Non-régression du <c>ProductSeeder</c> après le retrait des abris fixes (les abris sont devenus
/// des <c>ShelterModel</c> paramétriques, EPIC 9) :
///  - <c>RemoveLegacyShelterProductsAsync</c> SOFT-DELETE les 8 anciens abris fixes, est idempotent,
///    et ne touche JAMAIS les toiles/accessoires conservés ni un produit hors-liste ;
///  - <c>EnsureCategoriesAsync</c> upsert idempotent des catégories (conservé de la Phase 1).
/// Ces tests sont le garde-fou CI (L-005/L-031) du nettoyage d'un DB déjà semé.
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

    private Product Seed(string slug)
    {
        var product = Product.Create("Abri " + slug, slug, 199m, 5, _category.Id, "desc.");
        _db.Products.Add(product);
        _db.SaveChanges();
        return product;
    }

    // ── RemoveLegacyShelterProductsAsync (retrait idempotent des abris fixes) ─────

    [Fact]
    public async Task RemoveLegacy_SoftDeletesSeededShelterSlug()
    {
        // Un ancien abri fixe (slug du référentiel) est encore présent au catalogue.
        var p = Seed("abri-simple-une-voiture");

        await ProductSeeder.RemoveLegacyShelterProductsAsync(_db, NullLogger.Instance);

        // Soft-delete : la ligne existe toujours mais IsDeleted=true → exclue du filtre par défaut.
        var stillVisible = await _db.Products.AnyAsync(x => x.Slug == "abri-simple-une-voiture");
        stillVisible.Should().BeFalse();

        var deleted = await _db.Products
            .IgnoreQueryFilters()
            .SingleAsync(x => x.Id == p.Id);
        deleted.IsDeleted.Should().BeTrue();
        deleted.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RemoveLegacy_RemovesAllEightShelterSlugs()
    {
        string[] shelterSlugs =
        [
            "abri-simple-une-voiture", "abri-pente-unique", "abri-double-pic", "abri-double-rond",
            "abri-rangement-atelier", "abri-industriel-commercial", "abri-entree", "abri-passage-cloture",
        ];
        foreach (var slug in shelterSlugs) Seed(slug);

        await ProductSeeder.RemoveLegacyShelterProductsAsync(_db, NullLogger.Instance);

        // Aucun des 8 n'est plus visible ; les 8 lignes sont soft-deletées.
        (await _db.Products.CountAsync()).Should().Be(0);
        (await _db.Products.IgnoreQueryFilters().CountAsync(p => p.IsDeleted)).Should().Be(8);
    }

    [Fact]
    public async Task RemoveLegacy_LeavesCoversAndAccessoriesUntouched()
    {
        // Les produits CONSERVÉS (toiles + pièces/accessoires) ne doivent jamais être retirés.
        Seed("toile-remplacement-simple");
        Seed("toile-remplacement-double");
        Seed("kit-ancrage-sol");
        Seed("attaches-fixations");
        // Un abri fixe pour prouver que le retrait agit bien sur les bons slugs.
        Seed("abri-double-pic");

        await ProductSeeder.RemoveLegacyShelterProductsAsync(_db, NullLogger.Instance);

        var visibleSlugs = await _db.Products.Select(p => p.Slug).ToListAsync();
        visibleSlugs.Should().BeEquivalentTo(
            "toile-remplacement-simple", "toile-remplacement-double", "kit-ancrage-sol", "attaches-fixations");
        visibleSlugs.Should().NotContain("abri-double-pic");
    }

    [Fact]
    public async Task RemoveLegacy_NonExistentSlug_IsNoOp()
    {
        // Aucun abri fixe présent (seulement un produit conservé) → aucun changement, aucune erreur.
        var kept = Seed("kit-ancrage-sol");

        await ProductSeeder.RemoveLegacyShelterProductsAsync(_db, NullLogger.Instance);

        await _db.Entry(kept).ReloadAsync();
        kept.IsDeleted.Should().BeFalse();
        (await _db.Products.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task RemoveLegacy_IsIdempotent_SecondPassChangesNothing()
    {
        var p = Seed("abri-entree");

        await ProductSeeder.RemoveLegacyShelterProductsAsync(_db, NullLogger.Instance);
        await _db.Entry(p).ReloadAsync();
        var firstDeletedAt = p.DeletedAt;
        firstDeletedAt.Should().NotBeNull();

        // 2e passage : la ligne est déjà soft-deletée (exclue du filtre) → aucune réécriture.
        await ProductSeeder.RemoveLegacyShelterProductsAsync(_db, NullLogger.Instance);
        await _db.Entry(p).ReloadAsync();

        p.IsDeleted.Should().BeTrue();
        p.DeletedAt.Should().Be(firstDeletedAt);  // pas de SaveChanges → horodatage inchangé
        (await _db.Products.IgnoreQueryFilters().CountAsync(x => x.Slug == "abri-entree")).Should().Be(1);
    }

    // ── EnsureCategoriesAsync (upsert idempotent des catégories par slug, Phase 1) ──

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
