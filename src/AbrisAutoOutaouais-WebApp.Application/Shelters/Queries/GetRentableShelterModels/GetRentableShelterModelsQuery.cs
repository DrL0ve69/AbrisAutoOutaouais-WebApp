using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetRentableShelterModels;

/// <summary>
/// Liste les modèles d'abris LOUABLES (tarif mensuel non nul) avec les champs nécessaires au
/// formulaire de location (tarif + dimensions + grille). Lecture seule, publique.
/// </summary>
public sealed record GetRentableShelterModelsQuery
    : IQuery<IReadOnlyList<RentableShelterModelDto>>;
