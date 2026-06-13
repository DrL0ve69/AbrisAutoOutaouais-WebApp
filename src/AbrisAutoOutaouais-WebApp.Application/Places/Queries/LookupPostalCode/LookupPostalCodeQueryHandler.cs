using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Places.Queries.LookupPostalCode;

/// <summary>
/// Handler mince : délègue intégralement au port <see cref="IPlacesService"/>.
/// <c>HandleAsync</c> contient la logique (appelé par le Dispatcher) ; <c>Handle</c> satisfait
/// le contrat <see cref="IQueryHandler{TQuery,TResult}"/> et délègue.
/// </summary>
public sealed class LookupPostalCodeQueryHandler(IPlacesService placesService)
    : IQueryHandler<LookupPostalCodeQuery, string?>
{
    public Task<string?> HandleAsync(LookupPostalCodeQuery query, CancellationToken ct)
        => placesService.LookupPostalCodeAsync(query.CivicNumber, query.Street, query.City, query.Province, ct);

    public ValueTask<string?> Handle(LookupPostalCodeQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
