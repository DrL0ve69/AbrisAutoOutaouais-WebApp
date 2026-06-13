using AbrisAutoOutaouais_WebApp.Application.Products.Commands;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Products;

/// <summary>
/// Vérifie les règles de validation des dimensions à la mise à jour (mêmes bornes que
/// la création) : null accepté, 50 et 2000 valides, 49 et 2001 rejetés. Ce validator
/// n'existait pas avant D1 — l'Update n'était pas validé du tout.
/// </summary>
public sealed class UpdateProductCommandValidatorTests
{
    private readonly UpdateProductCommandValidator _validator = new();

    private static UpdateProductCommand Cmd(int? w = null, int? l = null, int? h = null)
        => new(
            Id: Guid.NewGuid(),
            Name: "Abri Simple",
            Description: "Un abri valide",
            Price: 299.99m,
            Stock: 5,
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
    [InlineData(50)]
    [InlineData(2000)]
    [InlineData(610)]
    public void Dimension_WithinInclusiveBounds_IsValid(int value)
    {
        var result = _validator.Validate(Cmd(w: value, l: value, h: value));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(49)]
    [InlineData(2001)]
    public void Width_OutOfBounds_IsInvalid(int value)
    {
        var result = _validator.Validate(Cmd(w: value));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateProductCommand.WidthCm));
    }

    [Theory]
    [InlineData(49)]
    [InlineData(2001)]
    public void Length_OutOfBounds_IsInvalid(int value)
    {
        var result = _validator.Validate(Cmd(l: value));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateProductCommand.LengthCm));
    }

    [Theory]
    [InlineData(49)]
    [InlineData(2001)]
    public void Height_OutOfBounds_IsInvalid(int value)
    {
        var result = _validator.Validate(Cmd(h: value));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateProductCommand.HeightCm));
    }
}
