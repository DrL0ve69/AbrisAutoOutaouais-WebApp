using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;

namespace AbrisAutoOutaouais_WebApp.Application.Places.Queries.SuggestAddresses;

/// <summary>
/// Handler mince : délègue intégralement au port <see cref="IPlacesService"/>.
/// <c>HandleAsync</c> contient la logique (appelé par le Dispatcher) ; <c>Handle</c> satisfait
/// le contrat <see cref="IQueryHandler{TQuery,TResult}"/> et délègue.
/// </summary>
public sealed class SuggestAddressesQueryHandler(IPlacesService placesService)
    : IQueryHandler<SuggestAddressesQuery, IReadOnlyList<PlaceSuggestionDto>>
{
    public Task<IReadOnlyList<PlaceSuggestionDto>> HandleAsync(SuggestAddressesQuery query, CancellationToken ct)
        => placesService.SuggestAsync(query.Query, query.City, query.Province, ct);

    public ValueTask<IReadOnlyList<PlaceSuggestionDto>> Handle(SuggestAddressesQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
