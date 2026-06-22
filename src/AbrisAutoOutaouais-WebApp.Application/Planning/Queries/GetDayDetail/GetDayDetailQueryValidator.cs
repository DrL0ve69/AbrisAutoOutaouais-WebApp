using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Queries.GetDayDetail;

/// <summary>
/// Borne la date demandée à une plage raisonnable (± ~5 ans) pour écarter une valeur aberrante
/// (date par défaut <c>0001-01-01</c> d'un paramètre manquant, par exemple).
/// </summary>
public sealed class GetDayDetailQueryValidator : AbstractValidator<GetDayDetailQuery>
{
    public GetDayDetailQueryValidator()
    {
        RuleFor(x => x.Date)
            .Must(d => d.Year is >= 2000 and <= 2100)
            .WithMessage("La date demandée est hors de la plage autorisée.");
    }
}
