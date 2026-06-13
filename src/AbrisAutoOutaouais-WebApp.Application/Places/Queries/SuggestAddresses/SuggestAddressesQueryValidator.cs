using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Places.Queries.SuggestAddresses;

/// <summary>
/// Le texte d'autocomplétion est requis : une query vide est rejetée par le
/// <c>ValidationBehavior</c> en 422 propre avant même d'appeler le fournisseur externe.
/// </summary>
public sealed class SuggestAddressesQueryValidator : AbstractValidator<SuggestAddressesQuery>
{
    public SuggestAddressesQueryValidator()
    {
        RuleFor(x => x.Query)
            .NotEmpty().WithMessage("Le texte de recherche est requis.")
            .MaximumLength(200);
    }
}
