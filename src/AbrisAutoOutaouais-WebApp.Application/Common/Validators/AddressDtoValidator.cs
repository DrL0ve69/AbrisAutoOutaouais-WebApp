using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Validators;

/// <summary>
/// Source canonique UNIQUE de validation d'une <see cref="AddressDto"/>, partagée par toutes
/// les commandes qui acceptent une adresse (caisse, location, installation). Une seule
/// définition garantit que la caisse, la location et l'installation acceptent EXACTEMENT le
/// même format que le profil enregistre et que l'autofill pré-remplit (voir leçon L-004 :
/// « un format partagé doit être validé pareil partout »).
/// </summary>
public sealed class AddressDtoValidator : AbstractValidator<AddressDto>
{
    public AddressDtoValidator()
    {
        // Numéro civique : chiffres avec une lettre finale optionnelle (« 123 », « 123A »).
        RuleFor(x => x.CivicNumber)
            .NotEmpty().WithMessage("Le numéro civique est requis.")
            .MaximumLength(10)
            .Matches(@"^\d+[A-Za-z]?$")
            .WithMessage("Numéro civique invalide (ex: 123 ou 123A).");

        // Appartement / unité : facultatif.
        RuleFor(x => x.Apartment)
            .MaximumLength(20)
            .When(x => !string.IsNullOrWhiteSpace(x.Apartment));

        RuleFor(x => x.Street)
            .NotEmpty().WithMessage("La rue est requise.")
            .MaximumLength(200);

        RuleFor(x => x.City)
            .NotEmpty().WithMessage("La ville est requise.")
            .MaximumLength(100);

        // Province : NON contrainte à une liste blanche. Imposer un ensemble fermé recréerait
        // la régression « adresse Ontario refusée → 400 » que la leçon L-004 verrouille : une
        // adresse hors Québec (ON, BC…) pré-remplie depuis le profil doit passer. On se limite
        // donc à « présente et de longueur raisonnable » (code à 2 lettres).
        RuleFor(x => x.Province)
            .NotEmpty().WithMessage("La province est requise.")
            .MaximumLength(2);

        // Format canadien, avec OU sans espace, majuscules ou minuscules (« J7T 1A1 » / « j7t1a1 »)
        // — déplacé depuis PlaceOrderCommandValidator pour rester l'unique référence (L-004).
        RuleFor(x => x.PostalCode)
            .Matches(@"^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$")
            .WithMessage("Format de code postal invalide (ex: J7T 1A1).");

        RuleFor(x => x.Country)
            .NotEmpty()
            .MaximumLength(50);
    }
}
