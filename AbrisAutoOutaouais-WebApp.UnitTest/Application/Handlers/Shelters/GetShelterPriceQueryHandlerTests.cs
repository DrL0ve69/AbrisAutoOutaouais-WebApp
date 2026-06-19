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
    /// Modèle aligné sur le référentiel par-largeur « simple-11pi » (rework EPIC 9 : une largeur =
    /// un modèle ; pas 122 cm, MIN 488 cm, base 1099,00 $, 150,00 $/arche) :
    /// longueur 488 → 0 arche, 732 → 2 arches.
    /// </summary>
    private async Task SeedModelAsync()
    {
        var model = ShelterModel.Create(
            slug: "simple-11pi",
            name: "Abri simple 11 pi",
            categoryId: _category.Id,
            lengthStepCm: 122,
            minLengthCm: 488,
            maxLengthCm: 1830,
            basePrice: 1099.00m,
            pricePerArchCents: 15000,
            widthsCm: [335],
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
            new GetShelterPriceQuery("simple-11pi", 488), CancellationToken.None);

        result.Slug.Should().Be("simple-11pi");
        result.LengthCm.Should().Be(488);
        result.ArchCount.Should().Be(0);
        result.TotalPrice.Should().Be(1099.00m);  // base seule
    }

    [Fact]
    public async Task Handle_MinPlusTwoSteps_ReturnsTwoArchesAndCorrectPrice()
    {
        await SeedModelAsync();

        // 488 + 2 × 122 = 732 cm → 2 arches → 1099 + 2 × 150 = 1399,00 $.
        var result = await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 732), CancellationToken.None);

        result.ArchCount.Should().Be(2);
        result.TotalPrice.Should().Be(1399.00m);
    }

    [Fact]
    public async Task Handle_LengthOutOfRange_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 2000 > MaxLengthCm (1830) → 422, jamais un 500 (ArgumentOutOfRangeException du calculateur).
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 2000), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_LengthMisaligned_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 600 ∈ [488, 1830] mais (600 - 488) % 122 = 112 ≠ 0 → désaligné → 422.
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 600), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_LengthBelowMin_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 366 < MinLengthCm (488) → hors plage → 422 (la borne min est désormais 488, rework EPIC 9).
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 366), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_UnknownSlug_ThrowsNotFoundException()
    {
        await SeedModelAsync();

        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("inexistant", 488), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    public void Dispose() => _db.Dispose();
}
