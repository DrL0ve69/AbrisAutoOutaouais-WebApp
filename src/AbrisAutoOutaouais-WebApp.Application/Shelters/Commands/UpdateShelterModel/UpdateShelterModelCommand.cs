using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.UpdateShelterModel;

/// <summary>
/// Reconfigure un modèle d'abri EXISTANT (édition admin, EPIC 9.5). Le slug est IMMUABLE :
/// il n'est PAS transporté ici. L'admin ne fixe PLUS les prix (grille EXACTE semée en lecture
/// seule) : la reconfiguration ne touche jamais la grille de prix du modèle.
/// </summary>
public sealed record UpdateShelterModelCommand(
    Guid Id,
    string Name,
    Guid CategoryId,
    int LengthStepCm,
    int MinLengthCm,
    int MaxLengthCm,
    IReadOnlyList<int> WidthsCm,
    IReadOnlyList<int> ClearHeightsCm
) : ICommand<bool>;
