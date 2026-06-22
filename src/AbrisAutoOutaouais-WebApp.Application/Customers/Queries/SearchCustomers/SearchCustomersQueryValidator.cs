using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Customers.Queries.SearchCustomers;

/// <summary>
/// Valide la recherche de clients : terme non vide, 2 à 100 caractères (évite une recherche trop
/// large/coûteuse côté Identity). Validé par le pipeline <c>ValidationBehavior</c> avant le handler.
/// </summary>
public sealed class SearchCustomersQueryValidator : AbstractValidator<SearchCustomersQuery>
{
    public SearchCustomersQueryValidator()
    {
        RuleFor(x => x.Term)
            .NotEmpty().WithMessage("Le terme de recherche est requis.")
            .MinimumLength(2).WithMessage("Le terme de recherche doit comporter au moins 2 caractères.")
            .MaximumLength(100).WithMessage("Le terme de recherche ne doit pas dépasser 100 caractères.");
    }
}
