using AbrisAutoOutaouais_WebApp.Domain.Entities;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Tests des invariants de la fabrique <see cref="ShelterModel.Create"/>, des options exposées et du
/// prix de départ dérivé de la grille (<see cref="ShelterModel.StartingPriceCents"/>). L'admin ne
/// fixe plus de prix : le constructeur prend une grille OPTIONNELLE (modèle possiblement non tarifé).
/// </summary>
public sealed class ShelterModelTests
{
    private static IReadOnlyList<ShelterModel.PriceEntryInput> Grid(int length, int height, int priceCents)
        => [new(length, height, priceCents)];

    private static ShelterModel CreateValid(
        IReadOnlyList<int>? widths = null,
        IReadOnlyList<int>? heights = null,
        int lengthStepCm = 122,
        int minLengthCm = 122,
        int maxLengthCm = 1830,
        IReadOnlyList<ShelterModel.PriceEntryInput>? priceEntries = null)
        => ShelterModel.Create(
            "simple", "Abri simple", Guid.NewGuid(),
            lengthStepCm, minLengthCm, maxLengthCm,
            widths ?? [335, 366], heights ?? [198], priceEntries);

    [Fact]
    public void Create_WithValidData_SetsState()
    {
        var categoryId = Guid.NewGuid();

        var model = ShelterModel.Create(
            "Simple", "Abri simple", categoryId,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            widthsCm: [366, 335], clearHeightsCm: [198],
            priceEntries: Grid(122, 198, 34900));

        model.Id.Should().NotBeEmpty();
        model.Slug.Should().Be("simple");              // normalisé en minuscules
        model.Name.Should().Be("Abri simple");
        model.CategoryId.Should().Be(categoryId);
        model.StartingPriceCents.Should().Be(34900);   // « à partir de » = min de la grille
        model.IsDeleted.Should().BeFalse();
        model.Dimensions.Should().HaveCount(3);        // 2 largeurs + 1 hauteur
        model.PriceEntries.Should().HaveCount(1);
    }

    [Fact]
    public void Create_WithoutPriceGrid_StartingPriceIsNull()
    {
        // Cas admin : modèle créé sans grille → non tarifé tant que rien n'est semé.
        var model = CreateValid(priceEntries: null);

        model.PriceEntries.Should().BeEmpty();
        model.StartingPriceCents.Should().BeNull();
    }

    [Fact]
    public void StartingPriceCents_IsMinimumOfGrid()
    {
        var model = CreateValid(
            heights: [198, 229],
            priceEntries:
            [
                new(122, 198, 50000),
                new(122, 229, 34900),   // le plus bas
                new(244, 198, 60000),
            ]);

        model.StartingPriceCents.Should().Be(34900);
    }

    [Fact]
    public void PriceFor_ReturnsExactCents_OrNullWhenAbsent()
    {
        var model = CreateValid(
            heights: [198, 229],
            priceEntries:
            [
                new(122, 198, 34900),
                new(244, 229, 59900),
            ]);

        model.PriceFor(122, 198).Should().Be(34900);
        model.PriceFor(244, 229).Should().Be(59900);
        model.PriceFor(244, 198).Should().BeNull();   // combinaison absente (grille éparse)
    }

    [Fact]
    public void SetPriceGrid_WithDuplicateCombination_Throws()
    {
        var model = CreateValid();
        var act = () => model.SetPriceGrid(
        [
            new(122, 198, 34900),
            new(122, 198, 40000),   // doublon (longueur, hauteur)
        ]);
        act.Should().Throw<ArgumentException>().WithMessage("*double*");
    }

    [Fact]
    public void WidthAndHeightOptions_AreSortedAscending()
    {
        var model = CreateValid(widths: [366, 335], heights: [274, 213, 244]);

        model.WidthOptionsCm.Should().Equal(335, 366);
        model.ClearHeightOptionsCm.Should().Equal(213, 244, 274);
    }

    [Fact]
    public void Create_WithNoWidth_Throws()
    {
        var act = () => CreateValid(widths: []);
        act.Should().Throw<ArgumentException>().WithMessage("*largeur*");
    }

    [Fact]
    public void Create_WithNoClearHeight_Throws()
    {
        var act = () => CreateValid(heights: []);
        act.Should().Throw<ArgumentException>().WithMessage("*hauteur*");
    }

    [Theory]
    [InlineData(122, 122)]   // min == max
    [InlineData(500, 122)]   // min > max
    public void Create_WithMinNotLessThanMax_Throws(int min, int max)
    {
        var act = () => CreateValid(minLengthCm: min, maxLengthCm: max);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-122)]
    public void Create_WithNonPositiveStep_Throws(int step)
    {
        var act = () => CreateValid(lengthStepCm: step);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_WithRangeNotMultipleOfStep_Throws()
    {
        // (1829 - 122) = 1707, non divisible par 122.
        var act = () => CreateValid(lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1829);
        act.Should().Throw<ArgumentException>().WithMessage("*multiple*");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Create_WithEmptySlug_Throws(string? slug)
    {
        var act = () => ShelterModel.Create(
            slug!, "Abri", Guid.NewGuid(), 122, 122, 1342, [335], [198]);
        act.Should().Throw<ArgumentException>();
    }

    // ── Tarif de location (rework « location sur modèle paramétrique ») ────────────

    [Fact]
    public void Create_WithoutMonthlyRental_IsNotRentable()
    {
        var model = CreateValid(); // monthlyRentalCents par défaut = null

        model.MonthlyRentalCents.Should().BeNull();
        model.MonthlyRentalPrice.Should().BeNull();
    }

    [Fact]
    public void Create_WithMonthlyRental_ExposesRateInDollars()
    {
        var model = ShelterModel.Create(
            "simple", "Abri simple", Guid.NewGuid(),
            122, 122, 1830, [335], [198],
            priceEntries: Grid(122, 198, 34900),
            monthlyRentalCents: 4900);

        model.MonthlyRentalCents.Should().Be(4900);
        model.MonthlyRentalPrice.Should().Be(49.00m);  // 4900 ¢ → 49 $
    }

    [Fact]
    public void SetMonthlyRental_Null_MakesNotRentable()
    {
        var model = ShelterModel.Create(
            "simple", "Abri simple", Guid.NewGuid(),
            122, 122, 1830, [335], [198], monthlyRentalCents: 4900);

        model.SetMonthlyRental(null);

        model.MonthlyRentalCents.Should().BeNull();
        model.MonthlyRentalPrice.Should().BeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void SetMonthlyRental_NonPositive_Throws(int cents)
    {
        var model = CreateValid();

        var act = () => model.SetMonthlyRental(cents);

        act.Should().Throw<ArgumentException>().WithMessage("*tarif*");
    }
}
