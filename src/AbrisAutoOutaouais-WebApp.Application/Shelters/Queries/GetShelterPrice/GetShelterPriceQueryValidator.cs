using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Garde d'entrée : la longueur demandée doit être strictement positive. Les bornes précises
/// (plage [Min, Max] et alignement sur le pas) dépendent du modèle ciblé et sont donc validées
/// dans le handler une fois le modèle chargé — d'où une seule règle générique ici.
/// </summary>
public sealed class GetShelterPriceQueryValidator : AbstractValidator<GetShelterPriceQuery>
{
    public GetShelterPriceQueryValidator()
    {
        RuleFor(x => x.LengthCm)
            .GreaterThan(0).WithMessage("La longueur demandée doit être supérieure à 0.");
    }
}
