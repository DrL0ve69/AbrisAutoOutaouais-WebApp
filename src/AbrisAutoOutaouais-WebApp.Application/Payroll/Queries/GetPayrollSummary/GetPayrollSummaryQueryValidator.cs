using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Queries.GetPayrollSummary;

/// <summary>
/// Valide la fenêtre de dates du récap de paie (EPIC 8) : <c>From ≤ To</c> et fenêtre ≤ 366 jours
/// (bornes incluses) pour éviter une agrégation déraisonnablement large.
/// </summary>
public sealed class GetPayrollSummaryQueryValidator : AbstractValidator<GetPayrollSummaryQuery>
{
    /// <summary>Largeur maximale de la fenêtre, en jours (bornes incluses) — une année bissextile.</summary>
    private const int MaxWindowDays = 366;

    public GetPayrollSummaryQueryValidator()
    {
        RuleFor(x => x)
            .Must(x => x.From <= x.To)
            .WithMessage("La date de début doit être antérieure ou égale à la date de fin.");

        RuleFor(x => x)
            .Must(x => x.From > x.To || x.To.DayNumber - x.From.DayNumber + 1 <= MaxWindowDays)
            .WithMessage($"La fenêtre ne peut excéder {MaxWindowDays} jours.");
    }
}
