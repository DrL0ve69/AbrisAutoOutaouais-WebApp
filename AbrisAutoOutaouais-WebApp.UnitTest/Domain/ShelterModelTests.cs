using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Tests des invariants de la fabrique <see cref="ShelterModel.Create"/> et des options exposées.
/// </summary>
public sealed class ShelterModelTests
{
    private static ShelterModel CreateValid(
        IReadOnlyList<int>? widths = null,
        IReadOnlyList<int>? heights = null,
        int lengthStepCm = 122,
        int minLengthCm = 122,
        int maxLengthCm = 1830,
        decimal basePrice = 349.00m,
        int pricePerArchCents = 15000)
        => ShelterModel.Create(
            "simple", "Abri simple", Guid.NewGuid(),
            lengthStepCm, minLengthCm, maxLengthCm, basePrice, pricePerArchCents,
            widths ?? [335, 366], heights ?? [198]);

    [Fact]
    public void Create_WithValidData_SetsState()
    {
        var categoryId = Guid.NewGuid();

        var model = ShelterModel.Create(
            "Simple", "Abri simple", categoryId,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            basePrice: 349.00m, pricePerArchCents: 15000,
            widthsCm: [366, 335], clearHeightsCm: [198]);

        model.Id.Should().NotBeEmpty();
        model.Slug.Should().Be("simple");              // normalisé en minuscules
        model.Name.Should().Be("Abri simple");
        model.CategoryId.Should().Be(categoryId);
        model.BasePrice.Should().Be(349.00m);
        model.IsDeleted.Should().BeFalse();
        model.Dimensions.Should().HaveCount(3);        // 2 largeurs + 1 hauteur
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

    [Fact]
    public void Create_WithNegativeBasePrice_Throws()
    {
        var act = () => CreateValid(basePrice: -1m);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_WithNegativePricePerArch_Throws()
    {
        var act = () => CreateValid(pricePerArchCents: -1);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Create_WithEmptySlug_Throws(string? slug)
    {
        var act = () => ShelterModel.Create(
            slug!, "Abri", Guid.NewGuid(), 122, 122, 1829, 349m, 15000, [335], [198]);
        act.Should().Throw<ArgumentException>();
    }
}
