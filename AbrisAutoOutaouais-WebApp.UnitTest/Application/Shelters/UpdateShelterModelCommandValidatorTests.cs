using AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.UpdateShelterModel;
using FluentValidation.TestHelper;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Shelters;

/// <summary>Calque du validateur Create SANS la règle Slug (slug immuable en édition).</summary>
public sealed class UpdateShelterModelCommandValidatorTests
{
    private readonly UpdateShelterModelCommandValidator _validator = new();

    private static UpdateShelterModelCommand Valid(
        string name = "Abri",
        int lengthStepCm = 122, int minLengthCm = 122, int maxLengthCm = 1830,
        IReadOnlyList<int>? widths = null, IReadOnlyList<int>? heights = null)
        => new(Guid.NewGuid(), name, Guid.NewGuid(), lengthStepCm, minLengthCm, maxLengthCm,
            widths ?? [335], heights ?? [198]);

    [Fact]
    public void Valid_PassesValidation()
        => _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void EmptyId_Fails()
    {
        var cmd = Valid() with { Id = Guid.Empty };
        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void EmptyName_Fails()
        => _validator.TestValidate(Valid(name: "")).ShouldHaveValidationErrorFor(x => x.Name);

    [Fact]
    public void EmptyCategory_Fails()
    {
        var cmd = Valid() with { CategoryId = Guid.Empty };
        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.CategoryId);
    }

    [Fact]
    public void StepNotPositive_Fails()
        => _validator.TestValidate(Valid(lengthStepCm: 0))
            .ShouldHaveValidationErrorFor(x => x.LengthStepCm);

    [Fact]
    public void MinGreaterOrEqualMax_Fails()
        => _validator.TestValidate(Valid(minLengthCm: 1830, maxLengthCm: 1830))
            .ShouldHaveValidationErrorFor(x => x.MaxLengthCm);

    [Fact]
    public void MisalignedStep_Fails()
        => _validator.TestValidate(Valid(minLengthCm: 122, maxLengthCm: 1000, lengthStepCm: 122))
            .ShouldHaveValidationErrorFor(x => x);

    [Fact]
    public void NoWidth_Fails()
        => _validator.TestValidate(Valid(widths: []))
            .ShouldHaveValidationErrorFor(x => x.WidthsCm);

    [Fact]
    public void NonPositiveWidth_Fails()
        => _validator.TestValidate(Valid(widths: [335, 0]))
            .ShouldHaveValidationErrorFor(x => x.WidthsCm);

    [Fact]
    public void NoClearHeight_Fails()
        => _validator.TestValidate(Valid(heights: []))
            .ShouldHaveValidationErrorFor(x => x.ClearHeightsCm);

    // Plus de règles de prix : l'admin ne fixe plus la tarification (grille exacte semée).
}
