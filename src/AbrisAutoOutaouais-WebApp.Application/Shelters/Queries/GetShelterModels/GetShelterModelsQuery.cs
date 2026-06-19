using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModels;

/// <summary>
/// Liste les modèles d'abris paramétriques du référentiel, éventuellement filtrés par
/// catégorie (<paramref name="CategorySlug"/> = slug de la catégorie produit rattachée).
/// </summary>
public sealed record GetShelterModelsQuery(string? CategorySlug = null)
    : IQuery<IReadOnlyList<ShelterModelSummaryDto>>;
