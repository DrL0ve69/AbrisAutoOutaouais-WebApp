using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Validators;
using FluentValidation.TestHelper;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>
/// Source canonique unique de validation d'adresse (leçon L-004). Vérifie la matrice du numéro
/// civique, le caractère optionnel de l'appartement, le format de code postal partagé, et —
/// garde-fou explicite — l'ABSENCE de liste blanche de provinces (une adresse Ontario doit passer).
/// </summary>
public sealed class AddressDtoValidatorTests
{
    private readonly AddressDtoValidator _validator = new();

    private static AddressDto Address(
        string civicNumber = "123",
        string? apartment = null,
        string street = "rue des Abris",
        string city = "Gatineau",
        string province = "QC",
        string postalCode = "J8X 1A1")
        => new(civicNumber, street, apartment, city, province, postalCode, "Canada");

    // ── Numéro civique ──────────────────────────────────────────────────────────
    [Theory]
    [InlineData("123")]   // chiffres
    [InlineData("1")]     // un seul chiffre
    [InlineData("123A")]  // lettre finale (suffixe d'unité)
    public void Validate_ValidCivicNumber_HasNoError(string civic)
    {
        _validator.TestValidate(Address(civicNumber: civic))
            .ShouldNotHaveValidationErrorFor(x => x.CivicNumber);
    }

    [Theory]
    [InlineData("")]          // vide
    [InlineData("   ")]       // espaces seulement
    [InlineData("ABC")]       // pas de chiffre
    [InlineData("12-34")]     // séparateur interdit
    [InlineData("12345678901")] // > 10 caractères
    public void Validate_InvalidCivicNumber_HasError(string civic)
    {
        _validator.TestValidate(Address(civicNumber: civic))
            .ShouldHaveValidationErrorFor(x => x.CivicNumber);
    }

    // ── Appartement (optionnel) ─────────────────────────────────────────────────
    [Fact]
    public void Validate_NullApartment_HasNoError()
    {
        _validator.TestValidate(Address(apartment: null))
            .ShouldNotHaveValidationErrorFor(x => x.Apartment);
    }

    [Fact]
    public void Validate_ApartmentTooLong_HasError()
    {
        _validator.TestValidate(Address(apartment: new string('A', 21)))
            .ShouldHaveValidationErrorFor(x => x.Apartment);
    }

    // ── Code postal ─────────────────────────────────────────────────────────────
    [Theory]
    [InlineData("J8X 1A1")] // avec espace
    [InlineData("J8X1A1")]  // sans espace
    [InlineData("j8x 1a1")] // minuscules
    public void Validate_ValidPostal_HasNoError(string postal)
    {
        _validator.TestValidate(Address(postalCode: postal))
            .ShouldNotHaveValidationErrorFor(x => x.PostalCode);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("J8X 1A")]
    [InlineData("")]
    public void Validate_InvalidPostal_HasError(string postal)
    {
        _validator.TestValidate(Address(postalCode: postal))
            .ShouldHaveValidationErrorFor(x => x.PostalCode);
    }

    // ── Province : PAS de liste blanche (leçon L-004) ───────────────────────────
    [Theory]
    [InlineData("ON")]
    [InlineData("BC")]
    [InlineData("AB")]
    public void Validate_NonQuebecProvince_HasNoError(string province)
    {
        _validator.TestValidate(Address(province: province))
            .ShouldNotHaveValidationErrorFor(x => x.Province);
    }

    [Fact]
    public void Validate_FullyValidAddress_HasNoErrors()
    {
        _validator.TestValidate(Address(apartment: "4B"))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_MissingStreetAndCity_HasErrors()
    {
        var result = _validator.TestValidate(Address(street: "", city: ""));
        result.ShouldHaveValidationErrorFor(x => x.Street);
        result.ShouldHaveValidationErrorFor(x => x.City);
    }
}
