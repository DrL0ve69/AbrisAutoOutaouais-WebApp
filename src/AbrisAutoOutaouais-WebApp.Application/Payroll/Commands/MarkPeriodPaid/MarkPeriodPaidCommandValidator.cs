using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.MarkPeriodPaid;

/// <summary>
/// Valide la commande de marquage de paie (EPIC 8) : employé requis, statut dans l'énumération, et
/// fenêtre cohérente (<c>From ≤ To</c>, ≤ 366 jours bornes incluses — miroir du récap).
/// </summary>
public sealed class MarkPeriodPaidCommandValidator : AbstractValidator<MarkPeriodPaidCommand>
{
    private const int MaxWindowDays = 366;

    public MarkPeriodPaidCommandValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("L'identifiant de l'employé est requis.");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Le statut de paie est invalide.");

        RuleFor(x => x)
            .Must(x => x.From <= x.To)
            .WithMessage("La date de début doit être antérieure ou égale à la date de fin.");

        RuleFor(x => x)
            .Must(x => x.From > x.To || x.To.DayNumber - x.From.DayNumber + 1 <= MaxWindowDays)
            .WithMessage($"La fenêtre ne peut excéder {MaxWindowDays} jours.");
    }
}
