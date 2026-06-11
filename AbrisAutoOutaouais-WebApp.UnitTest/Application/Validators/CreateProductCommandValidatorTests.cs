using AbrisAutoOutaouais_WebApp.Application.Products.Commands;
using FluentValidation.TestHelper;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>FluentValidation.TestHelper rend les tests de validateurs très lisibles.</summary>
public sealed class CreateProductCommandValidatorTests
{
    private readonly CreateProductCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_HasNoValidationErrors()
    {
        var cmd = new CreateProductCommand(
            Name: "Abri Simple",
            Description: "Un abri simple et efficace",
            Price: 299.99m,
            StockQuantity: 5,
            CategoryId: Guid.NewGuid());

        var result = _validator.TestValidate(cmd);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_WithEmptyName_HasValidationError(string name)
    {
        var cmd = new CreateProductCommand(name, "slug", 100m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_WithInvalidSlugFormat_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "Slug Invalide!", 100m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("*minuscules*");
    }

    [Fact]
    public void Validate_WithZeroPrice_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 0m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Price);
    }

    [Fact]
    public void Validate_WithNegativeStock_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 100m, -1, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.StockQuantity);
    }

    [Fact]
    public void Validate_WithPositiveRentalPrice_HasNoError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 100m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldNotHaveValidationErrorFor(x => x.Price);
    }

    [Fact]
    public void Validate_WithZeroRentalPrice_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 100m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Price);
    }
}
