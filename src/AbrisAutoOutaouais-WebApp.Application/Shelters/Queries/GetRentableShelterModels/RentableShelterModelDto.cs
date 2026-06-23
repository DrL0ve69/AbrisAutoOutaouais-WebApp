using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetRentableShelterModels;

/// <summary>
/// Vue d'un modèle d'abri LOUABLE pour le formulaire de location : tarif mensuel + les champs
/// dimensionnels dont le sélecteur de taille a besoin (bornes/pas de longueur, largeur, options de
/// hauteur dégagée et grille de prix EXACTE). Miroir de
/// <see cref="ShelterModelDetailDto"/> côté dimensions, afin que le client puisse
/// RÉUTILISER le même configurateur de dimensions ; on ajoute <see cref="MonthlyRentalPrice"/> (en
/// dollars) — toujours non nul ici puisque la query ne retourne que les modèles louables.
/// </summary>
public sealed record RentableShelterModelDto(
    string Slug,
    string Name,
    string CategoryName,
    decimal MonthlyRentalPrice,
    int MinLengthCm,
    int MaxLengthCm,
    int LengthStepCm,
    int WidthCm,
    IReadOnlyList<int> ClearHeightOptionsCm,
    IReadOnlyList<ShelterPriceGridEntryDto> PriceGrid);
