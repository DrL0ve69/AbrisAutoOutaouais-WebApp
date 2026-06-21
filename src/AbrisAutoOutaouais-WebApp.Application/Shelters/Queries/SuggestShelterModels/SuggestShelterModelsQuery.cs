using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.SuggestShelterModels;

/// <summary>
/// Suggère les MODÈLES d'abris paramétriques (EPIC 10, US-10.1) compatibles avec une empreinte au
/// sol mesurée (largeur ET longueur, en cm). On retient tout modèle dont la largeur fixe ≤ largeur
/// requise, on calcule ses longueurs admissibles (cf. <c>ShelterFitCalculator</c>), puis on agrège
/// le tout par CATÉGORIE. Une catégorie/un modèle n'apparaît qu'avec ≥ 1 longueur admissible.
/// </summary>
public sealed record SuggestShelterModelsQuery(int RequiredWidthCm, int RequiredLengthCm)
    : IQuery<IReadOnlyList<ShelterFitResultDto>>;
