using AbrisAutoOutaouais_WebApp.Application.Auth.ResetPassword;
using FluentValidation.TestHelper;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>
/// Garde-fou de contrat (L-004) : la politique de mot de passe acceptée ici doit
/// rester identique à celle d'Identity (DependencyInjection.cs) et du formulaire
/// client — un mot de passe validé puis refusé par Identity produirait un message
/// « lien invalide » trompeur.
/// </summary>
public sealed class ResetPasswordCommandValidatorTests
{
    private readonly ResetPasswordCommandValidator _validator = new();

    private static ResetPasswordCommand Command(
        string email = "client@test.com",
        string token = "jeton-valide",
        string newPassword = "Nouveau@123",
        string? confirmPassword = null) =>
        new(email, token, newPassword, confirmPassword ?? newPassword);

    [Theory]
    [InlineData("Nouveau@123")]  // politique complète
    [InlineData("Abc!5678")]     // longueur minimale exacte (8)
    [InlineData("P@ssw0rd Long avec espaces!")]
    public void Validate_WithValidCommand_HasNoErrors(string password)
    {
        _validator.TestValidate(Command(newPassword: password))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]            // vide
    [InlineData("Ab@1xyz")]     // trop court (7)
    [InlineData("nouveau@123")] // sans majuscule
    [InlineData("NOUVEAU@123")] // sans minuscule
    [InlineData("Nouveau@abc")] // sans chiffre
    [InlineData("Nouveau1234")] // sans caractère spécial
    public void Validate_WithWeakPassword_HasPasswordError(string password)
    {
        _validator.TestValidate(Command(newPassword: password))
            .ShouldHaveValidationErrorFor(x => x.NewPassword);
    }

    [Fact]
    public void Validate_WithMismatchedConfirmation_HasConfirmError()
    {
        _validator.TestValidate(Command(confirmPassword: "Different@456"))
            .ShouldHaveValidationErrorFor(x => x.ConfirmPassword);
    }

    [Fact]
    public void Validate_WithEmptyToken_HasTokenError()
    {
        _validator.TestValidate(Command(token: ""))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Theory]
    [InlineData("")]
    [InlineData("pas-un-courriel")]
    public void Validate_WithInvalidEmail_HasEmailError(string email)
    {
        _validator.TestValidate(Command(email: email))
            .ShouldHaveValidationErrorFor(x => x.Email);
    }
}
