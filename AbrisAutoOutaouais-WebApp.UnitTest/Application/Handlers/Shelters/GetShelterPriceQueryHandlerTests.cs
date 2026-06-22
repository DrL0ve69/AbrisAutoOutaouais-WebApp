using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Shelters;

/// <summary>
/// Couvre la résolution du prix par LOOKUP dans la grille exacte (combinaison longueur × hauteur),
/// les rejets métier (combinaison absente de la grille → 422 via <see cref="BusinessRuleException"/>)
/// et le slug inconnu → <see cref="NotFoundException"/> (404). Le calcul est délégué à
/// <c>ShelterPriceCalculator</c> (L-004) ; on vérifie ici le câblage handler + la traduction des
/// erreurs en exceptions HTTP. La grille est chargée explicitement (<c>.Include(PriceEntries)</c> — L-035).
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
    /// Modèle « simple-11pi » avec une grille calquée sur l'ancienne formule (base 1099 $, 150 $/arche,
    /// pas 122, min 488, hauteur 198) : longueur 488 → 1099 $, 732 → 1399 $.
    /// </summary>
    private async Task SeedModelAsync()
    {
        var model = ShelterModelTestData.CreateWithGrid(
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
    public async Task Handle_BaseLength_ReturnsBasePrice()
    {
        await SeedModelAsync();

        var result = await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 488, 198), CancellationToken.None);

        result.Slug.Should().Be("simple-11pi");
        result.LengthCm.Should().Be(488);
        result.ClearHeightCm.Should().Be(198);
        result.TotalPrice.Should().Be(1099.00m);  // entrée de base de la grille
    }

    [Fact]
    public async Task Handle_MinPlusTwoSteps_ReturnsCorrectGridPrice()
    {
        await SeedModelAsync();

        // 488 + 2 × 122 = 732 cm → 1099 + 2 × 150 = 1399,00 $.
        var result = await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 732, 198), CancellationToken.None);

        result.TotalPrice.Should().Be(1399.00m);
    }

    [Fact]
    public async Task Handle_LengthOutOfRange_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 2000 cm n'a aucune entrée dans la grille → 422, jamais un 500.
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 2000, 198), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_ClearHeightNotInGrid_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 259 cm n'est pas une hauteur de la grille (seule 198 semée) → 422.
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 488, 259), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_LengthMisaligned_ThrowsBusinessRuleException()
    {
        await SeedModelAsync();

        // 600 n'est pas une longueur de la grille (entrées par pas de 122 depuis 488) → 422.
        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("simple-11pi", 600, 198), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_UnknownSlug_ThrowsNotFoundException()
    {
        await SeedModelAsync();

        var act = async () => await Handler.Handle(
            new GetShelterPriceQuery("inexistant", 488, 198), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    public void Dispose() => _db.Dispose();
}
