using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Customers.Queries.SearchCustomers;

/// <summary>
/// Recherche de clients (rôle <c>Customer</c>) par nom complet ou courriel, pour rattacher un RDV
/// à un client existant depuis le calendrier admin (US-11.2). Limitée à 10 résultats.
/// </summary>
public sealed record SearchCustomersQuery(string Term) : IQuery<IReadOnlyList<CustomerSearchResultDto>>;

/// <summary>
/// Délègue au port <see cref="IIdentityService"/> (frontière : la couche Application n'énumère pas
/// <c>AppUser</c> directement). Auto-enregistré par Scrutor — aucun enregistrement DI manuel.
/// </summary>
internal sealed class SearchCustomersQueryHandler(IIdentityService identity)
    : IQueryHandler<SearchCustomersQuery, IReadOnlyList<CustomerSearchResultDto>>
{
    private const int MaxResults = 10;

    public Task<IReadOnlyList<CustomerSearchResultDto>> HandleAsync(
        SearchCustomersQuery query, CancellationToken ct)
        => identity.SearchCustomersAsync(query.Term, MaxResults, ct);

    public ValueTask<IReadOnlyList<CustomerSearchResultDto>> Handle(
        SearchCustomersQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
