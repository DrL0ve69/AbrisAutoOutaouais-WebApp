using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetShelterCatalog;

/// <summary>
/// Catalogue des marques → modèles → dimensions, dérivé du référentiel des modèles d'abris
/// paramétriques (EPIC 9). Sans paramètre (record vide). Alimente les listes déroulantes du
/// formulaire d'installation (G2).
/// </summary>
public sealed record GetShelterCatalogQuery : IQuery<IReadOnlyList<BrandCatalogDto>>;
