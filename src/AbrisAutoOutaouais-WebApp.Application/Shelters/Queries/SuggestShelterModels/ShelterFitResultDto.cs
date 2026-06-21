namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.SuggestShelterModels;

/// <summary>
/// Résultat de suggestion agrégé par CATÉGORIE : la catégorie, sa plus grande largeur retenue
/// (<see cref="CategoryMaxWidthCm"/> = max des largeurs des modèles retenus de la catégorie), et la
/// liste des modèles compatibles. Une catégorie n'apparaît que si elle contient ≥ 1 modèle ayant
/// lui-même ≥ 1 longueur admissible.
/// </summary>
public sealed record ShelterFitResultDto(
    string CategorySlug,
    string CategoryName,
    int CategoryMaxWidthCm,
    IReadOnlyList<ShelterFitModelDto> Models);

/// <summary>
/// Modèle d'abri compatible avec la mesure : son identité, sa largeur fixe, son prix de base, ses
/// bornes de longueur (min + pas, pour reconfigurer côté client) et la liste des longueurs
/// admissibles en cm (<see cref="AvailableLengthsCm"/>, déjà bornées par la mesure et le plafond
/// 40 pi — cf. <c>ShelterFitCalculator</c>).
/// </summary>
public sealed record ShelterFitModelDto(
    Guid Id,
    string Slug,
    string Name,
    int WidthCm,
    decimal BasePrice,
    int MinLengthCm,
    int LengthStepCm,
    IReadOnlyList<int> AvailableLengthsCm);
