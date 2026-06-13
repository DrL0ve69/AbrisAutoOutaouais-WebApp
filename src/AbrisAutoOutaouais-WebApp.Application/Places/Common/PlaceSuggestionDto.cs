namespace AbrisAutoOutaouais_WebApp.Application.Places.Common;

/// <summary>
/// Suggestion d'adresse renvoyée par le proxy Places (autocomplétion).
/// Définition canonique UNIQUE côté serveur (leçon L-004) : ses champs reprennent la
/// terminologie de <c>AddressDto</c> issue de C1 (<c>CivicNumber</c> / <c>Street</c> /
/// <c>City</c> / <c>Province</c> / <c>PostalCode</c>) pour que l'autofill côté client
/// puisse pré-remplir les formulaires sans transformation de format.
/// <para>
/// <c>Lat</c> / <c>Lng</c> sont portés dès maintenant pour l'Epic D (géocodage / carte) ;
/// ils ne sont PAS utilisés en C2 mais évitent une rupture de contrat plus tard.
/// </para>
/// </summary>
public sealed record PlaceSuggestionDto(
    string Label,
    string? CivicNumber,
    string Street,
    string City,
    string Province,
    string? PostalCode,
    double? Lat,
    double? Lng);
