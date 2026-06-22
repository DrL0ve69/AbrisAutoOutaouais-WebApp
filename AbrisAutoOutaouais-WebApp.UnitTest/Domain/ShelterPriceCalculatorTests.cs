using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Tests du service de domaine pur <see cref="ShelterPriceCalculator"/>, désormais un LOOKUP dans la
/// grille de prix exacte (modèle × longueur × hauteur dégagée), en cents → dollars. La grille peut
/// être ÉPARSE : une combinaison absente lève <see cref="ArgumentOutOfRangeException"/> (contrat
/// préservé, traduit en 422 par les handlers amont).
/// </summary>
public sealed class ShelterPriceCalculatorTests
{
    // Modèle « simple » avec une petite grille explicite (deux longueurs × deux hauteurs).
    private static ShelterModel Simple() => ShelterModel.Create(
        "simple", "Abri simple", Guid.NewGuid(),
        lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
        widthsCm: [335], clearHeightsCm: [198, 229],
        priceEntries:
        [
            new(122, 198, 34900),   // 349,00 $
            new(122, 229, 47400),   // 474,00 $
            new(244, 198, 42400),   // 424,00 $
            new(244, 229, 59900),   // 599,00 $
        ]);

    [Fact]
    public void CalculatePrice_ExactCombination_ReturnsGridPriceInDollars()
    {
        ShelterPriceCalculator.CalculatePrice(Simple(), 122, 198).Should().Be(349.00m);
        ShelterPriceCalculator.CalculatePrice(Simple(), 122, 229).Should().Be(474.00m);
        ShelterPriceCalculator.CalculatePrice(Simple(), 244, 229).Should().Be(599.00m);
    }

    [Fact]
    public void CalculatePrice_DifferentHeightSameLength_ResolvesDistinctPrices()
    {
        // Le prix dépend bien de la HAUTEUR, pas seulement de la longueur.
        var model = Simple();
        ShelterPriceCalculator.CalculatePrice(model, 244, 198).Should().Be(424.00m);
        ShelterPriceCalculator.CalculatePrice(model, 244, 229).Should().Be(599.00m);
    }

    [Theory]
    [InlineData(366, 198)]   // longueur absente de la grille
    [InlineData(122, 259)]   // hauteur absente de la grille
    [InlineData(244, 259)]   // combinaison éparse absente
    public void CalculatePrice_CombinationAbsentFromGrid_Throws(int lengthCm, int clearHeightCm)
    {
        var act = () => ShelterPriceCalculator.CalculatePrice(Simple(), lengthCm, clearHeightCm);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void CalculatePrice_EmptyGrid_Throws()
    {
        // Modèle non tarifé (aucune grille) → toute demande de prix lève.
        var model = ShelterModel.Create(
            "non-tarife", "Abri non tarifé", Guid.NewGuid(),
            122, 122, 1830, widthsCm: [335], clearHeightsCm: [198]);

        var act = () => ShelterPriceCalculator.CalculatePrice(model, 122, 198);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
