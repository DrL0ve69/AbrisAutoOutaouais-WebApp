namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModels;

/// <summary>
/// Vue résumée d'un modèle d'abri paramétrique (alimente les listes du catalogue).
/// Les options de dimensions (largeurs/hauteurs) ne figurent pas ici : voir le détail par slug.
/// </summary>
public sealed record ShelterModelSummaryDto(
    Guid Id,
    string Slug,
    string Name,
    string CategoryName,
    decimal BasePrice,
    int MinLengthCm,
    int MaxLengthCm,
    int LengthStepCm);
