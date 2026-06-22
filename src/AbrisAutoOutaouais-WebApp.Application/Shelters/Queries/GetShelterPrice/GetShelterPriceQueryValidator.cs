using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Garde d'entrée : la longueur ET la hauteur dégagée demandées doivent être strictement positives.
/// La validité fine (combinaison présente dans la grille du modèle, bornes/alignement de longueur)
/// dépend du modèle ciblé et est donc vérifiée dans le handler une fois le modèle chargé.
/// </summary>
public sealed class GetShelterPriceQueryValidator : AbstractValidator<GetShelterPriceQuery>
{
    public GetShelterPriceQueryValidator()
    {
        RuleFor(x => x.LengthCm)
            .GreaterThan(0).WithMessage("La longueur demandée doit être supérieure à 0.");

        RuleFor(x => x.ClearHeightCm)
            .GreaterThan(0).WithMessage("La hauteur dégagée demandée doit être supérieure à 0.");
    }
}
