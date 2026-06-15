using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Common.Validators;
using FluentValidation.TestHelper;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>
/// Source canonique unique de validation d'un contact invité (Épic F). Vérifie courriel valide,
/// nom/prénom requis et bornés, téléphone optionnel mais raisonnable s'il est présent.
/// </summary>
public sealed class GuestContactValidatorTests
{
    private readonly GuestContactValidator _validator = new();

    private static GuestContact Valid(
        string firstName = "Jean", string lastName = "Tremblay",
        string email = "jean@test.com", string? phone = "819-555-0199")
        => new(firstName, lastName, email, phone);

    [Fact]
    public void Validate_WithValidContact_HasNoErrors()
        => _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void Validate_WithoutPhone_HasNoErrors()
        => _validator.TestValidate(Valid(phone: null)).ShouldNotHaveAnyValidationErrors();

    [Theory]
    [InlineData("")]
    [InlineData("pas-un-courriel")]
    [InlineData("manque@")]
    public void Validate_WithInvalidEmail_HasEmailError(string email)
        => _validator.TestValidate(Valid(email: email))
            .ShouldHaveValidationErrorFor(x => x.Email);

    [Fact]
    public void Validate_WithEmptyFirstName_HasError()
        => _validator.TestValidate(Valid(firstName: ""))
            .ShouldHaveValidationErrorFor(x => x.FirstName);

    [Fact]
    public void Validate_WithEmptyLastName_HasError()
        => _validator.TestValidate(Valid(lastName: ""))
            .ShouldHaveValidationErrorFor(x => x.LastName);

    [Fact]
    public void Validate_WithTooLongFirstName_HasError()
        => _validator.TestValidate(Valid(firstName: new string('a', 101)))
            .ShouldHaveValidationErrorFor(x => x.FirstName);

    [Theory]
    [InlineData("819-555-0199")]
    [InlineData("(819) 555-0199")]
    [InlineData("+1 819 555 0199")]
    public void Validate_WithReasonablePhone_HasNoPhoneError(string phone)
        => _validator.TestValidate(Valid(phone: phone))
            .ShouldNotHaveValidationErrorFor(x => x.Phone);

    [Theory]
    [InlineData("123")]                 // trop court
    [InlineData("abcdefghij")]          // lettres
    [InlineData("555-0199 ext. 4242")]  // caractères non autorisés
    public void Validate_WithUnreasonablePhone_HasPhoneError(string phone)
        => _validator.TestValidate(Valid(phone: phone))
            .ShouldHaveValidationErrorFor(x => x.Phone);
}
