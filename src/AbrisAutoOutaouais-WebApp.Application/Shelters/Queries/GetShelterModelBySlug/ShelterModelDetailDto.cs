namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;

/// <summary>
/// Détail complet d'un modèle d'abri paramétrique : bornes/pas de longueur, options de largeur et de
/// hauteur dégagée (en cm), et la GRILLE DE PRIX EXACTE complète (<see cref="PriceGrid"/>) dont le
/// configurateur a besoin pour le calcul optimiste et le prix par (longueur × hauteur).
///
/// <see cref="BasePrice"/> (en dollars) est le « à partir de » = MINIMUM de la grille (0 si la
/// grille est vide). Le nom de champ est CONSERVÉ pour ne pas casser le catalogue/suggestion côté
/// client ; il n'y a plus de colonne stockée ni de prix par arche.
/// </summary>
public sealed record ShelterModelDetailDto(
    Guid Id,
    string Slug,
    string Name,
    Guid CategoryId,
    string CategoryName,
    decimal BasePrice,
    int MinLengthCm,
    int MaxLengthCm,
    int LengthStepCm,
    IReadOnlyList<int> WidthOptionsCm,
    IReadOnlyList<int> ClearHeightOptionsCm,
    IReadOnlyList<ShelterPriceGridEntryDto> PriceGrid);
