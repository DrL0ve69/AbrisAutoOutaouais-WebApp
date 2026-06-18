using AbrisAutoOutaouais_WebApp.Domain.Services;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Tests du service de domaine pur <see cref="ShelterPriceCalculator"/>.
/// Formule : archCount = (lengthCm - minLengthCm) / lengthStepCm ;
///           total = basePrice + archCount * (pricePerArchCents / 100m).
/// Invariant épinglé : longueur de base = MinLengthCm → 0 arche (L-007).
/// </summary>
public sealed class ShelterPriceCalculatorTests
{
    // Modèle « simple » du référentiel : pas 122 cm (4 pi), 122→1830 (14 pas), base 349 $, 150 $/arche.
    private static ShelterModel Simple() => ShelterModel.Create(
        "simple", "Abri simple", Guid.NewGuid(),
        lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
        basePrice: 349.00m, pricePerArchCents: 15000,
        widthsCm: [335, 366], clearHeightsCm: [198]);

    // Modèle « double-rond » : pas de 152 cm (5 pi), 457→1065 (4 pas), base 1149 $.
    private static ShelterModel DoubleRond() => ShelterModel.Create(
        "double-rond", "Abri double rond", Guid.NewGuid(),
        lengthStepCm: 152, minLengthCm: 457, maxLengthCm: 1065,
        basePrice: 1149.00m, pricePerArchCents: 15000,
        widthsCm: [549, 610], clearHeightsCm: [213, 239]);

    [Fact]
    public void ArchCount_AtBaseLength_IsZero()
    {
        // Longueur de base = MinLengthCm → aucune arche supplémentaire.
        ShelterPriceCalculator.ArchCount(Simple(), 122).Should().Be(0);
    }

    [Fact]
    public void CalculatePrice_AtBaseLength_IsBasePrice()
    {
        ShelterPriceCalculator.CalculatePrice(Simple(), 122).Should().Be(349.00m);
    }

    [Theory]
    [InlineData(122, 0, 349.00)]   // base
    [InlineData(244, 1, 499.00)]   // +1 pas → +1 arche → +150
    [InlineData(366, 2, 649.00)]   // +2 arches
    [InlineData(1830, 14, 2449.00)] // longueur max : (1830-122)/122 = 14 arches → 349 + 14*150
    public void CalculatePrice_SimpleModel_FollowsArchFormula(int lengthCm, int expectedArches, decimal expectedPrice)
    {
        var model = Simple();

        ShelterPriceCalculator.ArchCount(model, lengthCm).Should().Be(expectedArches);
        ShelterPriceCalculator.CalculatePrice(model, lengthCm).Should().Be(expectedPrice);
    }

    [Theory]
    [InlineData(457, 0, 1149.00)]   // base (min = 457)
    [InlineData(609, 1, 1299.00)]   // +1 pas de 152 → +150
    [InlineData(1065, 4, 1749.00)]  // max : (1065-457)/152 = 4 arches
    public void CalculatePrice_DoubleRond_UsesFivePieStep(int lengthCm, int expectedArches, decimal expectedPrice)
    {
        var model = DoubleRond();

        ShelterPriceCalculator.ArchCount(model, lengthCm).Should().Be(expectedArches);
        ShelterPriceCalculator.CalculatePrice(model, lengthCm).Should().Be(expectedPrice);
    }

    [Theory]
    [InlineData(100)]   // sous le minimum (122)
    [InlineData(2000)]  // au-dessus du maximum (1830)
    public void ArchCount_LengthOutOfRange_Throws(int lengthCm)
    {
        var act = () => ShelterPriceCalculator.ArchCount(Simple(), lengthCm);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Theory]
    [InlineData(180)]   // 180-122 = 58, non divisible par 122
    [InlineData(200)]   // non aligné sur le pas
    public void ArchCount_LengthNotAlignedOnStep_Throws(int lengthCm)
    {
        var act = () => ShelterPriceCalculator.ArchCount(Simple(), lengthCm);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void CalculatePrice_NotAlignedOnStep_Throws()
    {
        // 500 cm pour le double-rond : (500-457)=43, non divisible par 152.
        var act = () => ShelterPriceCalculator.CalculatePrice(DoubleRond(), 500);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
