using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain.Services;

/// <summary>
/// Tests du service de domaine pur <see cref="ShelterFitCalculator"/> (EPIC 10, US-10.1).
///  - <see cref="ShelterFitCalculator.Fits"/> : frontière largeur (== passe, &gt; non).
///  - <see cref="ShelterFitCalculator.AvailableLengths"/> : bornage par longueur requise, par
///    longueur max du modèle, et par le plafond 40 pi (<see cref="ShelterFit.MaxSuggestedLengthCm"/>) ;
///    base hors borne → liste vide ; alignement sur le pas.
/// </summary>
public sealed class ShelterFitCalculatorTests
{
    // ── Fits ────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Fits_WhenModelWidthEqualsRequired_IsTrue()
        => ShelterFitCalculator.Fits(modelWidthCm: 488, requiredWidthCm: 488).Should().BeTrue();

    [Fact]
    public void Fits_WhenModelWidthBelowRequired_IsTrue()
        => ShelterFitCalculator.Fits(modelWidthCm: 335, requiredWidthCm: 914).Should().BeTrue();

    [Fact]
    public void Fits_WhenModelWidthAboveRequired_IsFalse()
        => ShelterFitCalculator.Fits(modelWidthCm: 549, requiredWidthCm: 488).Should().BeFalse();

    // ── AvailableLengths ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void AvailableLengths_BoundedByRequiredLength()
    {
        // Min 488, pas 122, max modèle 1830, requis 914 → 488, 610, 732, 854 (≤914) ; 976 > 914 exclu.
        var lengths = ShelterFitCalculator.AvailableLengths(
            minLengthCm: 488, lengthStepCm: 122, maxLengthCm: 1830, requiredLengthCm: 914);

        lengths.Should().Equal(488, 610, 732, 854);
    }

    [Fact]
    public void AvailableLengths_BoundedByModelMaxLength()
    {
        // max modèle 732 < requis 5000 et < plafond → 488, 610, 732 (732 inclus, pile la max).
        var lengths = ShelterFitCalculator.AvailableLengths(
            minLengthCm: 488, lengthStepCm: 122, maxLengthCm: 732, requiredLengthCm: 5000);

        lengths.Should().Equal(488, 610, 732);
    }

    [Fact]
    public void AvailableLengths_BoundedByMaxSuggestedCap_1219()
    {
        // requis 1800 et max modèle 1830 dépassent le plafond métier 1219 (40 pi) :
        // 488, 610, 732, 854, 976, 1098 (≤1219) ; 1220 > 1219 exclu.
        var lengths = ShelterFitCalculator.AvailableLengths(
            minLengthCm: 488, lengthStepCm: 122, maxLengthCm: 1830, requiredLengthCm: 1800);

        ShelterFit.MaxSuggestedLengthCm.Should().Be(1219);
        lengths.Should().Equal(488, 610, 732, 854, 976, 1098);
        lengths.Should().OnlyContain(l => l <= ShelterFit.MaxSuggestedLengthCm);
    }

    [Fact]
    public void AvailableLengths_WhenBaseExceedsRequired_IsEmpty()
    {
        // La longueur de base (488) dépasse déjà la longueur requise (400) → aucune longueur.
        var lengths = ShelterFitCalculator.AvailableLengths(
            minLengthCm: 488, lengthStepCm: 122, maxLengthCm: 1830, requiredLengthCm: 400);

        lengths.Should().BeEmpty();
    }

    [Fact]
    public void AvailableLengths_ExactStepMultiple_IncludesTopBound()
    {
        // requis pile sur un multiple du pas (732 = 488 + 2×122) → la borne haute est incluse.
        var lengths = ShelterFitCalculator.AvailableLengths(
            minLengthCm: 488, lengthStepCm: 122, maxLengthCm: 1830, requiredLengthCm: 732);

        lengths.Should().Equal(488, 610, 732);
    }

    [Fact]
    public void AvailableLengths_WithNonPositiveStep_Throws()
    {
        var act = () => ShelterFitCalculator.AvailableLengths(488, 0, 1830, 914);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
