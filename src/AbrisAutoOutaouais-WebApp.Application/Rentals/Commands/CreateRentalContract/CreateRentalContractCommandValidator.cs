using AbrisAutoOutaouais_WebApp.Application.Common.Validators;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;

/// <summary>
/// Valide une demande de contrat de location. L'adresse passe par la source canonique unique
/// (<see cref="AddressDtoValidator"/>) — même format que le profil/l'autofill (leçon L-004).
/// La cohérence des dates et le caractère louable du produit restent du ressort de l'agrégat
/// <c>RentalContract.Create()</c>.
/// </summary>
public sealed class CreateRentalContractCommandValidator : AbstractValidator<CreateRentalContractCommand>
{
    public CreateRentalContractCommandValidator()
    {
        RuleFor(x => x.ProductId)
            .NotEmpty().WithMessage("Le produit est requis.");

        RuleFor(x => x.StartDate)
            .NotEmpty().WithMessage("La date de début est requise.");

        RuleFor(x => x.EndDate)
            .NotEmpty().WithMessage("La date de fin est requise.")
            .GreaterThan(x => x.StartDate).WithMessage("La date de fin doit être après la date de début.");

        RuleFor(x => x.Address)
            .NotNull().WithMessage("L'adresse est requise.")
            .SetValidator(new AddressDtoValidator());
    }
}
