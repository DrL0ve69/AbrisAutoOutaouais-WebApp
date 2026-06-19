using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.UpdateShelterModel;

/// <summary>
/// Calque exact du validateur de création SANS la règle Slug (le slug est immuable en édition).
/// Réplique tous les invariants du domaine → 422 plutôt qu'un <see cref="ArgumentException"/> 500.
/// </summary>
public sealed class UpdateShelterModelCommandValidator : AbstractValidator<UpdateShelterModelCommand>
{
    public UpdateShelterModelCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("L'identifiant du modèle est requis.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Le nom est requis.")
            .MaximumLength(100);

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("La catégorie est requise.");

        RuleFor(x => x.LengthStepCm)
            .GreaterThan(0).WithMessage("Le pas de longueur doit être strictement positif.");

        RuleFor(x => x.MinLengthCm)
            .GreaterThan(0).WithMessage("La longueur minimale doit être strictement positive.");

        RuleFor(x => x.MaxLengthCm)
            .GreaterThan(x => x.MinLengthCm)
            .WithMessage("La longueur maximale doit être supérieure à la minimale.");

        RuleFor(x => x)
            .Must(c => (c.MaxLengthCm - c.MinLengthCm) % c.LengthStepCm == 0)
            .When(c => c.LengthStepCm > 0 && c.MaxLengthCm > c.MinLengthCm)
            .WithMessage("La plage de longueur doit être un multiple entier du pas.");

        RuleFor(x => x.WidthsCm)
            .NotEmpty().WithMessage("Au moins une largeur est requise.")
            .Must(w => w is not null && w.All(v => v > 0))
            .WithMessage("Chaque largeur doit être un entier strictement positif.");

        RuleFor(x => x.ClearHeightsCm)
            .NotEmpty().WithMessage("Au moins une hauteur dégagée est requise.")
            .Must(h => h is not null && h.All(v => v > 0))
            .WithMessage("Chaque hauteur dégagée doit être un entier strictement positif.");

        RuleFor(x => x.BasePrice)
            .GreaterThanOrEqualTo(0).WithMessage("Le prix de base ne peut pas être négatif.");

        RuleFor(x => x.PricePerArchCents)
            .GreaterThanOrEqualTo(0).WithMessage("Le prix par arche ne peut pas être négatif.");
    }
}
