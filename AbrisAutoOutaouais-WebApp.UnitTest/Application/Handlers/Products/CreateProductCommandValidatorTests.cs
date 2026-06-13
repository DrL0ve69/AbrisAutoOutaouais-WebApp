using AbrisAutoOutaouais_WebApp.Application.Products.Commands;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Products;

/// <summary>
/// Vérifie les règles de validation des dimensions à la création :
/// null accepté, bornes inclusives 50 et 2000 valides, 49 et 2001 rejetés.
/// </summary>
public sealed class CreateProductCommandValidatorTests
{
    private readonly CreateProductCommandValidator _validator = new();

    private static CreateProductCommand Cmd(int? w = null, int? l = null, int? h = null)
        => new(
            Name: "Abri Simple",
            Description: "Un abri valide",
            Price: 299.99m,
            StockQuantity: 5,
            CategoryId: Guid.NewGuid(),
            WidthCm: w,
            LengthCm: l,
            HeightCm: h);

    [Fact]
    public void Dimensions_AllNull_IsValid()
    {
        var result = _validator.Validate(Cmd());

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(50)]    // borne basse inclusive
    [InlineData(2000)]  // borne haute inclusive
    [InlineData(335)]   // valeur usuelle
    public void Dimension_WithinInclusiveBounds_IsValid(int value)
    {
        var result = _validator.Validate(Cmd(w: value, l: value, h: value));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(49)]    // sous la borne basse
    [InlineData(2001)]  // au-dessus de la borne haute
    [InlineData(0)]
    public void Width_OutOfBounds_IsInvalid(int value)
    {
        var result = _validator.Validate(Cmd(w: value));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateProductCommand.WidthCm));
    }

    [Theory]
    [InlineData(49)]
    [InlineData(2001)]
    public void Length_OutOfBounds_IsInvalid(int value)
    {
        var result = _validator.Validate(Cmd(l: value));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateProductCommand.LengthCm));
    }

    [Theory]
    [InlineData(49)]
    [InlineData(2001)]
    public void Height_OutOfBounds_IsInvalid(int value)
    {
        var result = _validator.Validate(Cmd(h: value));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateProductCommand.HeightCm));
    }
}
