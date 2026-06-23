using AbrisAutoOutaouais_WebApp.Application.Common.Validators;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;

/// <summary>
/// Valide une demande de contrat de location. L'adresse passe par la source canonique unique
/// (<see cref="AddressDtoValidator"/>) — même format que le profil/l'autofill (leçon L-004).
/// La cohérence des dates, le caractère louable du modèle et l'admissibilité de la taille (longueur ×
/// hauteur dégagée, contre la grille) restent du ressort de l'agrégat <c>RentalContract.CreateForModel()</c>
/// — on ne fait ici que des gardes de forme (présence/positivité).
/// </summary>
public sealed class CreateRentalContractCommandValidator : AbstractValidator<CreateRentalContractCommand>
{
    public CreateRentalContractCommandValidator()
    {
        RuleFor(x => x.Slug)
            .NotEmpty().WithMessage("Le modèle d'abri est requis.");

        RuleFor(x => x.LengthCm)
            .GreaterThan(0).WithMessage("La longueur doit être strictement positive.");

        RuleFor(x => x.ClearHeightCm)
            .GreaterThan(0).WithMessage("La hauteur dégagée doit être strictement positive.");

        RuleFor(x => x.StartDate)
            .NotEmpty().WithMessage("La date de début est requise.");

        RuleFor(x => x.EndDate)
            .NotEmpty().WithMessage("La date de fin est requise.")
            .GreaterThan(x => x.StartDate).WithMessage("La date de fin doit être après la date de début.");

        RuleFor(x => x.Address)
            .NotNull().WithMessage("L'adresse est requise.")
            .SetValidator(new AddressDtoValidator());

        // Parcours invité : contact validé seulement s'il est fourni (connecté → null), par la
        // source canonique unique GuestContactValidator (leçon L-004).
        When(x => x.GuestContact is not null, () =>
        {
            RuleFor(x => x.GuestContact!).SetValidator(new GuestContactValidator());
        });
    }
}
