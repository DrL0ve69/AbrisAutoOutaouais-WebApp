using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.SuggestShelterModels;

/// <summary>
/// Dimensions requises : strictement positives et ≤ 2000 cm (borne haute alignée sur le gabarit
/// front <c>FOOTPRINT_MAX_CM</c> ; au-delà l'UI n'appelle même pas l'endpoint). Hors plage →
/// le <c>ValidationBehavior</c> rejette en 422 propre plutôt qu'un 200 vide. Messages FR.
/// </summary>
public sealed class SuggestShelterModelsQueryValidator : AbstractValidator<SuggestShelterModelsQuery>
{
    /// <summary>Borne haute des dimensions requises (cm), miroir du <c>FOOTPRINT_MAX_CM</c> client.</summary>
    private const int MaxRequiredCm = 2000;

    public SuggestShelterModelsQueryValidator()
    {
        RuleFor(x => x.RequiredWidthCm)
            .GreaterThan(0).WithMessage("La largeur requise doit être supérieure à 0.")
            .LessThanOrEqualTo(MaxRequiredCm)
            .WithMessage($"La largeur requise ne peut pas dépasser {MaxRequiredCm} cm.");

        RuleFor(x => x.RequiredLengthCm)
            .GreaterThan(0).WithMessage("La longueur requise doit être supérieure à 0.")
            .LessThanOrEqualTo(MaxRequiredCm)
            .WithMessage($"La longueur requise ne peut pas dépasser {MaxRequiredCm} cm.");
    }
}
