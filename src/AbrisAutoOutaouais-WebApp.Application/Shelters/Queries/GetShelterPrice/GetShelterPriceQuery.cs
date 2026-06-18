using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Calcule le prix d'un modèle d'abri (par slug) pour une longueur configurée en cm.
/// La longueur doit être dans la plage [Min, Max] du modèle et alignée sur son pas.
/// </summary>
public sealed record GetShelterPriceQuery(string Slug, int LengthCm) : IQuery<ShelterPriceDto>;
