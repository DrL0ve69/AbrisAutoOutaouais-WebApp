using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Validators;

/// <summary>
/// Source canonique UNIQUE de validation d'un <see cref="GuestContact"/>, partagée par toutes les
/// commandes qui acceptent un contact invité (caisse, location, installation). Une seule définition
/// garantit que les trois parcours acceptent EXACTEMENT le même format (leçon L-004 : « un format
/// partagé doit être validé pareil partout »). NE touche PAS à l'adresse — celle-ci reste validée
/// par <c>AddressDtoValidator</c> ; aucune liste blanche de province ici (L-004 / L-011).
/// </summary>
public sealed class GuestContactValidator : AbstractValidator<GuestContact>
{
    public GuestContactValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("Le prénom est requis.")
            .MaximumLength(100);

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Le nom est requis.")
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Le courriel est requis.")
            .EmailAddress().WithMessage("Format de courriel invalide.")
            .MaximumLength(256);

        // Téléphone facultatif. Format raisonnable s'il est fourni : 10 à 20 caractères composés
        // de chiffres, espaces, et des séparateurs usuels (+, -, ., parenthèses).
        RuleFor(x => x.Phone)
            .Matches(@"^[\d\s().+-]{10,20}$")
                .WithMessage("Format de téléphone invalide.")
            .When(x => !string.IsNullOrWhiteSpace(x.Phone));
    }
}
