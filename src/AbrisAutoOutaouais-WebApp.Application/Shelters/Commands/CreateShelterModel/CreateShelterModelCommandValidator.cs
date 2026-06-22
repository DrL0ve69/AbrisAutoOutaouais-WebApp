using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.CreateShelterModel;

/// <summary>
/// Réplique TOUS les invariants de <see cref="Domain.Entities.ShelterModel"/> côté Application
/// pour qu'une saisie invalide produise un 422 (ValidationException) plutôt qu'un
/// <see cref="ArgumentException"/> brut (qui retomberait en 500). Messages en français.
/// </summary>
public sealed class CreateShelterModelCommandValidator : AbstractValidator<CreateShelterModelCommand>
{
    public CreateShelterModelCommandValidator()
    {
        RuleFor(x => x.Slug)
            .NotEmpty().WithMessage("Le slug est requis.")
            .MaximumLength(100);

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

        // Alignement du pas : la plage [min, max] doit être un multiple entier du pas.
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

        // Plus de règles de prix : l'admin ne fixe plus la tarification (grille exacte semée).
    }
}
