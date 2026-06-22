namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;

/// <summary>
/// Une entrée de la grille de prix EXACTE exposée au configurateur : prix (en CENTS) pour une
/// combinaison (longueur × hauteur dégagée), en cm. Le client s'en sert pour le calcul optimiste et
/// pour afficher le prix par combinaison sans rappeler l'API à chaque changement.
/// </summary>
public sealed record ShelterPriceGridEntryDto(
    int LengthCm,
    int ClearHeightCm,
    int PriceCents);
