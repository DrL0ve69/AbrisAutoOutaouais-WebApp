using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Calcule le prix EXACT d'un modèle d'abri (par slug) pour une combinaison configurée
/// (longueur × hauteur dégagée) en cm. Le prix provient d'un LOOKUP dans la grille semée du modèle :
/// la combinaison doit exister (grille potentiellement ÉPARSE).
/// </summary>
public sealed record GetShelterPriceQuery(string Slug, int LengthCm, int ClearHeightCm)
    : IQuery<ShelterPriceDto>;
