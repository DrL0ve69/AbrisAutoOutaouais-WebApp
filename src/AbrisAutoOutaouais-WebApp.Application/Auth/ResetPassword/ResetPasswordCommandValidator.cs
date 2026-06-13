using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Auth.ResetPassword;

/// <summary>
/// Miroir de la politique de mot de passe d'Identity (DependencyInjection.cs :
/// longueur ≥ 8, majuscule, minuscule, chiffre, caractère spécial) et du
/// formulaire d'inscription côté client (auth.ts). Garder les trois alignés —
/// un mot de passe accepté ici mais refusé par Identity produirait un message
/// trompeur (L-004 : un format partagé = UNE définition).
/// </summary>
public sealed class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Le courriel est requis.")
            .EmailAddress().WithMessage("Format de courriel invalide.");

        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Le jeton de réinitialisation est requis.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Le nouveau mot de passe est requis.")
            .MinimumLength(8).WithMessage("Le mot de passe doit contenir au moins 8 caractères.")
            .Matches("[A-Z]").WithMessage("Le mot de passe doit contenir au moins une majuscule.")
            .Matches("[a-z]").WithMessage("Le mot de passe doit contenir au moins une minuscule.")
            .Matches("[0-9]").WithMessage("Le mot de passe doit contenir au moins un chiffre.")
            .Matches("[^a-zA-Z0-9]")
                .WithMessage("Le mot de passe doit contenir au moins un caractère spécial.");

        RuleFor(x => x.ConfirmPassword)
            .Equal(x => x.NewPassword).WithMessage("Les mots de passe ne correspondent pas.");
    }
}
