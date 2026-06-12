using AbrisAutoOutaouais_WebApp.Application.Auth.ForgotPassword;
using FluentValidation.TestHelper;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

public sealed class ForgotPasswordCommandValidatorTests
{
    private readonly ForgotPasswordCommandValidator _validator = new();

    [Theory]
    [InlineData("client@test.com")]
    [InlineData("prenom.nom+tag@exemple.qc.ca")]
    public void Validate_WithValidEmail_HasNoErrors(string email)
    {
        _validator.TestValidate(new ForgotPasswordCommand(email))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]                // vide
    [InlineData("   ")]             // espaces
    [InlineData("pas-un-courriel")] // sans @
    [InlineData("a@")]              // domaine manquant
    public void Validate_WithInvalidEmail_HasEmailError(string email)
    {
        _validator.TestValidate(new ForgotPasswordCommand(email))
            .ShouldHaveValidationErrorFor(x => x.Email);
    }
}
