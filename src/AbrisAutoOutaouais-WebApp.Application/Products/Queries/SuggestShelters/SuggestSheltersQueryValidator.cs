using AbrisAutoOutaouais_WebApp.Domain.Constants;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.SuggestShelters;

/// <summary>
/// Les dimensions requises doivent être strictement positives et ne pas dépasser la
/// borne haute des dimensions produit : au-delà, aucun abri du catalogue ne peut
/// convenir, donc le <c>ValidationBehavior</c> rejette en 422 propre plutôt que de
/// renvoyer un 200 systématiquement vide. Seuils partagés via <see cref="ProductDimensions"/> (L-004).
/// </summary>
public sealed class SuggestSheltersQueryValidator : AbstractValidator<SuggestSheltersQuery>
{
    public SuggestSheltersQueryValidator()
    {
        RuleFor(x => x.RequiredWidthCm)
            .GreaterThan(0).WithMessage("La largeur requise doit être supérieure à 0.")
            .LessThanOrEqualTo(ProductDimensions.MaxCm)
            .WithMessage($"La largeur requise ne peut pas dépasser {ProductDimensions.MaxCm} cm.");

        RuleFor(x => x.RequiredLengthCm)
            .GreaterThan(0).WithMessage("La longueur requise doit être supérieure à 0.")
            .LessThanOrEqualTo(ProductDimensions.MaxCm)
            .WithMessage($"La longueur requise ne peut pas dépasser {ProductDimensions.MaxCm} cm.");
    }
}
