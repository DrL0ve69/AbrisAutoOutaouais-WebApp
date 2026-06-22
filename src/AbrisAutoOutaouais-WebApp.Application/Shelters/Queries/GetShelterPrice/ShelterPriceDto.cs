namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Résultat d'un calcul de prix EXACT : la combinaison retenue (longueur × hauteur dégagée) et le
/// prix total (en dollars). Le prix provient d'un lookup dans la grille du modèle
/// (<c>ShelterPriceCalculator</c>) — il n'y a plus de notion de nombre d'arches (formule retirée).
/// </summary>
public sealed record ShelterPriceDto(
    Guid ModelId,
    string Slug,
    int LengthCm,
    int ClearHeightCm,
    decimal TotalPrice);
