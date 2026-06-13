using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;

namespace AbrisAutoOutaouais_WebApp.Application.Places.Queries.SuggestAddresses;

/// <summary>
/// Autocomplétion d'adresse : <c>Query</c> est le texte saisi ; <c>City</c> / <c>Province</c>
/// sont des indices facultatifs pour affiner la recherche.
/// </summary>
public sealed record SuggestAddressesQuery(string Query, string? City, string? Province)
    : IQuery<IReadOnlyList<PlaceSuggestionDto>>;
