using AbrisAutoOutaouais_WebApp.Domain.Entities;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Commands.UpsertWorkHours;

/// <summary>
/// Réplique les invariants du domaine (<see cref="WorkHoursEntry"/>) côté Application → 422 plutôt
/// qu'une <see cref="Domain.Exceptions.BusinessRuleException"/> remontée du domaine. Chaque borne,
/// si présente, est dans [0, 1440[ ; si les deux sont présentes, la fin est strictement après le
/// début ; la note est ≤ 500 caractères.
/// </summary>
public sealed class UpsertWorkHoursCommandValidator : AbstractValidator<UpsertWorkHoursCommand>
{
    public UpsertWorkHoursCommandValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("L'identifiant de l'employé est requis.");

        RuleFor(x => x.Date)
            .Must(d => d.Year is >= 2000 and <= 2100)
            .WithMessage("La date est hors de la plage autorisée.");

        RuleFor(x => x.StartMinutes)
            .InclusiveBetween(0, WorkHoursEntry.MinutesPerDay - 1)
            .When(x => x.StartMinutes is not null)
            .WithMessage("L'heure de début doit être comprise entre 00:00 et 23:59.");

        RuleFor(x => x.EndMinutes)
            .InclusiveBetween(0, WorkHoursEntry.MinutesPerDay - 1)
            .When(x => x.EndMinutes is not null)
            .WithMessage("L'heure de fin doit être comprise entre 00:00 et 23:59.");

        RuleFor(x => x)
            .Must(x => x.EndMinutes > x.StartMinutes)
            .When(x => x.StartMinutes is not null && x.EndMinutes is not null)
            .WithMessage("L'heure de fin doit être postérieure à l'heure de début.");

        RuleFor(x => x.Note)
            .MaximumLength(500).WithMessage("La note ne peut excéder 500 caractères.");
    }
}
