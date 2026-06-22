using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.SetHourlyRate;

/// <summary>
/// Valide la commande de taux horaire (EPIC 8) : l'employé est requis ; le taux est soit <c>null</c>
/// (taux non défini), soit strictement positif et ≤ 10 000 CAD/h (garde-fou contre une saisie aberrante).
/// </summary>
public sealed class SetHourlyRateCommandValidator : AbstractValidator<SetHourlyRateCommand>
{
    public SetHourlyRateCommandValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("L'identifiant de l'employé est requis.");

        RuleFor(x => x.HourlyRate)
            .InclusiveBetween(0.01m, 10000m)
            .When(x => x.HourlyRate is not null)
            .WithMessage("Le taux horaire doit être supérieur à 0 et au plus 10 000 $.");
    }
}
