using AbrisAutoOutaouais_WebApp.Application.Products.Queries.SuggestShelters;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Products;

/// <summary>
/// Couvre le filtrage (dimensions null / trop petites exclues, taille pile incluse),
/// le tri plus-petit-suffisant d'abord (empreinte croissante, tie-break nom),
/// le calcul des marges + drapeau IsTightFit, et l'exclusion des soft-deleted.
/// </summary>
public sealed class SuggestSheltersQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ProductCategory _category = ProductCategory.Create("Abris", "abris");

    public SuggestSheltersQueryHandlerTests()
    {
        _db.ProductCategories.Add(_category);
        _db.SaveChanges();
    }

    private async Task<Product> SeedAsync(
        string name, string slug, int? widthCm, int? lengthCm, int? heightCm = null,
        string? brand = null, string? model = null)
    {
        var product = Product.Create(
            name, slug, 199.99m, 5, _category.Id,
            widthCm: widthCm, lengthCm: lengthCm, heightCm: heightCm,
            brand: brand, model: model);
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return product;
    }

    private SuggestSheltersQueryHandler Handler => new(_db);

    [Fact]
    public async Task Handle_ProductWithoutDimensions_IsExcluded()
    {
        await SeedAsync("Sans dim", "sans-dim", widthCm: null, lengthCm: null);

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ProductTooSmallInWidthOrLength_IsExcluded()
    {
        await SeedAsync("Trop étroit", "trop-etroit", widthCm: 200, lengthCm: 500);  // largeur < requis
        await SeedAsync("Trop court", "trop-court", widthCm: 400, lengthCm: 300);      // longueur < requis

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ProductExactlyRequiredSize_IsIncludedWithZeroMarginsAndTightFit()
    {
        await SeedAsync("Pile poil", "pile-poil", widthCm: 300, lengthCm: 400, heightCm: 250);

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        result.Should().ContainSingle();
        var dto = result[0];
        dto.Slug.Should().Be("pile-poil");
        dto.WidthCm.Should().Be(300);
        dto.LengthCm.Should().Be(400);
        dto.HeightCm.Should().Be(250);
        dto.WidthMarginCm.Should().Be(0);
        dto.LengthMarginCm.Should().Be(0);
        dto.IsTightFit.Should().BeTrue();  // marges 0 < seuil
    }

    [Fact]
    public async Task Handle_SufficientShelters_AreOrderedBySmallestFootprintThenName()
    {
        // Empreintes : grand = 600*600 = 360000 ; moyen = 500*500 = 250000 ;
        // petit-a/petit-b = 400*500 = 200000 (égalité → tie-break par nom : "Petit A" < "Petit B").
        await SeedAsync("Grand", "grand", widthCm: 600, lengthCm: 600);
        await SeedAsync("Moyen", "moyen", widthCm: 500, lengthCm: 500);
        await SeedAsync("Petit B", "petit-b", widthCm: 400, lengthCm: 500);
        await SeedAsync("Petit A", "petit-a", widthCm: 500, lengthCm: 400);

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        result.Select(r => r.Slug).Should()
            .ContainInOrder("petit-a", "petit-b", "moyen", "grand");
    }

    [Fact]
    public async Task Handle_IsTightFit_FalseWhenBothMarginsAtOrAboveThreshold()
    {
        // Marges = 50 et 60, toutes deux ≥ TightFitMarginCm (50) → pas serré.
        await SeedAsync("Confort", "confort", widthCm: 350, lengthCm: 460);

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        var dto = result.Single(r => r.Slug == "confort");
        dto.WidthMarginCm.Should().Be(50);
        dto.LengthMarginCm.Should().Be(60);
        dto.IsTightFit.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_IsTightFit_TrueWhenOneMarginBelowThreshold()
    {
        // Marge largeur = 49 (< 50) → serré, même si la marge longueur est large.
        await SeedAsync("Juste large", "juste-large", widthCm: 349, lengthCm: 600);

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        var dto = result.Single(r => r.Slug == "juste-large");
        dto.WidthMarginCm.Should().Be(49);
        dto.WidthMarginCm.Should().BeLessThan(ProductDimensions.TightFitMarginCm);
        dto.IsTightFit.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ProjectsBrandAndModel_FromCatalog()
    {
        // G3 — marque/modèle exposés tels quels (texte du catalogue, format inchangé — L-004/L-011).
        await SeedAsync("Avec marque", "avec-marque", widthCm: 400, lengthCm: 500,
            brand: "Abris Tempo", model: "Tempo Duo 18x20");

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        var dto = result.Single(r => r.Slug == "avec-marque");
        dto.Brand.Should().Be("Abris Tempo");
        dto.Model.Should().Be("Tempo Duo 18x20");
    }

    [Fact]
    public async Task Handle_ProductWithoutBrandModel_ProjectsNulls()
    {
        // Un abri sans marque/modèle (saisie partielle) → champs null, pas d'erreur.
        await SeedAsync("Sans marque", "sans-marque", widthCm: 400, lengthCm: 500);

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        var dto = result.Single(r => r.Slug == "sans-marque");
        dto.Brand.Should().BeNull();
        dto.Model.Should().BeNull();
    }

    [Fact]
    public async Task Handle_SoftDeletedProduct_IsExcluded()
    {
        var product = await SeedAsync("Supprimé", "supprime", widthCm: 400, lengthCm: 500);
        product.IsDeleted = true;
        await _db.SaveChangesAsync();

        var result = await Handler.Handle(
            new SuggestSheltersQuery(300, 400), CancellationToken.None);

        // HasQueryFilter(p => !p.IsDeleted) exclut le produit
        result.Should().BeEmpty();
    }

    public void Dispose() => _db.Dispose();
}
