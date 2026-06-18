namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;

/// <summary>
/// Détail complet d'un modèle d'abri paramétrique : bornes/pas de longueur, prix de base et
/// prix par arche, ainsi que les options de largeur et de hauteur dégagée proposées (en cm).
/// </summary>
public sealed record ShelterModelDetailDto(
    Guid Id,
    string Slug,
    string Name,
    string CategoryName,
    decimal BasePrice,
    int MinLengthCm,
    int MaxLengthCm,
    int LengthStepCm,
    int PricePerArchCents,
    IReadOnlyList<int> WidthOptionsCm,
    IReadOnlyList<int> ClearHeightOptionsCm);
