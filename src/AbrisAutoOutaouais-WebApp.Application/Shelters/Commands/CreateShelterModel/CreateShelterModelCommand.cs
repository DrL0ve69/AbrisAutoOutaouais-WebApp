using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.CreateShelterModel;

/// <summary>
/// Crée un modèle d'abri paramétrique (référentiel admin, EPIC 9.5). L'admin ne fixe PLUS les prix :
/// la tarification provient d'une grille EXACTE semée (lecture seule). Un modèle créé ici n'a donc
/// AUCUNE grille et reste « non tarifé » tant qu'une grille n'est pas semée pour son slug.
/// </summary>
public sealed record CreateShelterModelCommand(
    string Slug,
    string Name,
    Guid CategoryId,
    int LengthStepCm,
    int MinLengthCm,
    int MaxLengthCm,
    IReadOnlyList<int> WidthsCm,
    IReadOnlyList<int> ClearHeightsCm
) : ICommand<Guid>;
