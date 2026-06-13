using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Places.Queries.LookupPostalCode;

/// <summary>
/// Résolution du code postal d'une adresse civique complète. Renvoie la chaîne du code
/// postal (ou <c>null</c> si introuvable).
/// </summary>
public sealed record LookupPostalCodeQuery(string CivicNumber, string Street, string City, string Province)
    : IQuery<string?>;
