using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Commands.OptimizeRoute;

/// <summary>
/// Valide la commande d'optimisation : une date dans une plage raisonnable (non par défaut).
/// </summary>
public sealed class OptimizeRouteCommandValidator : AbstractValidator<OptimizeRouteCommand>
{
    public OptimizeRouteCommandValidator()
    {
        RuleFor(x => x.Date)
            .NotEqual(default(DateOnly)).WithMessage("La date est requise.")
            .Must(d => d.Year is >= 2000 and <= 2100)
            .WithMessage("La date est hors de la plage autorisée.");
    }
}
