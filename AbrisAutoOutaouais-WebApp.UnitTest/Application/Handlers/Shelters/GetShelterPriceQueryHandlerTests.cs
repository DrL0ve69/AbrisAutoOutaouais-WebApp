using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Shelters;

/// <summary>
/// Couvre le calcul de prix par arches (longueur de base → 0 arche = prix de base ; pas multiples
/// → archCount et prix corrects), les rejets métier (longueur hors plage / désalignée → 422 via
/// <see cref="BusinessRuleException"/>) et le slug inconnu → <see cref="NotFoundException"/> (404).
/// Le calcul lui-même est délégué à <c>ShelterPriceCalculator</c> (L-004) : on vérifie ici le
/// câblage handler + la traduction des erreurs en exceptions HTTP, pas une formule réimplémentée.
/// </summary>
public sealed class GetShelterPriceQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ProductCategory _category = ProductCategory.Create("Abris simples", "abris-simples");

    public GetShelterPriceQueryHandlerTests()
    {
        _db.ProductCategories.Add(_category);
        _db.SaveChanges();
    }

    /// <summary>
    /// Modèle aligné sur le référentiel « simple » (pas/min 122 cm, base 349,00 $, 150,00 $/arche) :
    /// longueur 122 → 0 arche, 366 → 2 arches.
    /// </summary>
    private async Task SeedModelAsync()
    {
        var model = ShelterModel.Create(
            slug: "simple",
            name: "Abri simple",
            categoryId: _category.Id,
            lengthStepCm: 122,
            minLengthCm: 122,
            maxLengthCm: 1830,
            basePrice: 349.00m,
            pricePerArchCents: 15000,
            widthsCm: [335, 366],
            clearHeightsCm: [198]);
        _db.ShelterModels.Add(model);
        await _db.SaveChangesAsync();
    }

    private GetShelterPriceQueryHandler Handler => new(_db);

    [Fact]
    public async Task Handle_BaseLength_ReturnsZeroArchesAndBasePrice()
    {
        await SeedModelAsync();

        var result = await Handler.Handle(
            new GetShelterPriceQuery("simple", 122), CancellationToken.None);

        result.Slug.Should().Be("simple");
        result.LengthCm.Should().Be(122);
        result.ArchCount.Should().Be(0);
        result.TotalPrice.Should().Be(349.00m);  // base seule
    }

    [Fact]
    public async Task Handle_MinPlusTwoSteps_ReturnsTwoArchesAndCorrectPrice()
    {
        await SeedModelAsync();

        // 122 + 2 × 122 = 366 cm → 2 arches → 349 + 2 × 150 = 649,00 $.
        var result = await Handler.Handle(
            new GetShelterPriceQuery("simple", 366), CancellationToken.None);

        result.ArchCount.Should().Be(2);
        result.TotalPrice.Should().Be(649.00m);
    }

    [Fact]
    public async Task Handle_LengthOutOfRange_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 2000 > MaxLengthCm (1830) → 422, jamais un 500 (ArgumentOutOfRangeException du calculateur).
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple", 2000), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_LengthMisaligned_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 200 ∈ [122, 1830] mais (200 - 122) % 122 = 78 ≠ 0 → désaligné → 422.
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple", 200), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_UnknownSlug_ThrowsNotFoundException()
    {
        await SeedModelAsync();

        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("inexistant", 122), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    public void Dispose() => _db.Dispose();
}
