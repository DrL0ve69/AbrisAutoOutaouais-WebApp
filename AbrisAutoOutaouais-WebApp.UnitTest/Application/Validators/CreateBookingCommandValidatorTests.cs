using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using FluentValidation.TestHelper;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>
/// Couvre le fold-in « marque/modèle » (Épic C) : la marque ShelterLogic est rejetée (casse + trim),
/// les autres marques et la marque vide sont acceptées, et marque/modèle sont bornés à 100 caractères.
/// Épingle aussi la source canonique d'exclusion <see cref="ExcludedShelterBrands"/> (leçon L-004).
/// </summary>
public sealed class CreateBookingCommandValidatorTests
{
    private readonly CreateBookingCommandValidator _validator = new();

    private static AddressDto Address()
        => new("123", "rue des Abris", null, "Gatineau", "QC", "J8X 1A1", "Canada");

    private static CreateBookingCommand Command(string? brand = null, string? model = null)
        => new(
            SlotStart: DateTime.UtcNow.AddDays(7),
            Type: BookingType.Installation,
            Address: Address(),
            Notes: null,
            Brand: brand,
            Model: model);

    // ── Exclusion ShelterLogic (casse + trim) ───────────────────────────────────
    [Theory]
    [InlineData("ShelterLogic")]
    [InlineData("shelterlogic")]   // casse différente
    [InlineData("SHELTERLOGIC")]
    [InlineData("  ShelterLogic  ")] // espaces autour
    public void Validate_ShelterLogicBrand_HasError(string brand)
    {
        _validator.TestValidate(Command(brand: brand))
            .ShouldHaveValidationErrorFor(x => x.Brand)
            .WithErrorMessage("Nous n'installons pas la marque ShelterLogic.");
    }

    // ── Marques acceptées ───────────────────────────────────────────────────────
    [Theory]
    [InlineData("Abri Plus")]
    [InlineData("Abris Tempo")]
    public void Validate_OtherBrand_HasNoError(string brand)
    {
        _validator.TestValidate(Command(brand: brand))
            .ShouldNotHaveValidationErrorFor(x => x.Brand);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_EmptyBrand_HasNoError(string? brand)
    {
        _validator.TestValidate(Command(brand: brand))
            .ShouldNotHaveValidationErrorFor(x => x.Brand);
    }

    // ── Longueurs maximales ─────────────────────────────────────────────────────
    [Fact]
    public void Validate_BrandTooLong_HasError()
    {
        _validator.TestValidate(Command(brand: new string('A', 101)))
            .ShouldHaveValidationErrorFor(x => x.Brand);
    }

    [Fact]
    public void Validate_ModelTooLong_HasError()
    {
        _validator.TestValidate(Command(model: new string('M', 101)))
            .ShouldHaveValidationErrorFor(x => x.Model);
    }

    [Fact]
    public void Validate_BrandAndModelAtMaxLength_HasNoError()
    {
        _validator.TestValidate(Command(brand: new string('A', 100), model: new string('M', 100)))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_NullModel_HasNoError()
    {
        _validator.TestValidate(Command(model: null))
            .ShouldNotHaveValidationErrorFor(x => x.Model);
    }

    // ── Épinglage de la source canonique (leçon L-004) ──────────────────────────
    [Fact]
    public void ExcludedShelterBrands_ContainsExactlyShelterLogic()
    {
        ExcludedShelterBrands.Names.Should().BeEquivalentTo(new[] { "ShelterLogic" });
    }

    [Theory]
    [InlineData("shelterlogic", true)]   // casse ignorée
    [InlineData("  ShelterLogic  ", true)] // trim
    [InlineData("Abri Plus", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void ExcludedShelterBrands_IsExcluded_NormalizesCaseAndWhitespace(string? brand, bool expected)
    {
        ExcludedShelterBrands.IsExcluded(brand).Should().Be(expected);
    }
}
