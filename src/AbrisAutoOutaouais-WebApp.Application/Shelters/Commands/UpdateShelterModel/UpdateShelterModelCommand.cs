using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.UpdateShelterModel;

/// <summary>
/// Reconfigure un modèle d'abri EXISTANT (édition admin, EPIC 9.5). Le slug est IMMUABLE :
/// il n'est PAS transporté ici. <c>BasePrice</c> en DOLLARS ; <c>PricePerArchCents</c> en CENTS.
/// </summary>
public sealed record UpdateShelterModelCommand(
    Guid Id,
    string Name,
    Guid CategoryId,
    int LengthStepCm,
    int MinLengthCm,
    int MaxLengthCm,
    decimal BasePrice,
    int PricePerArchCents,
    IReadOnlyList<int> WidthsCm,
    IReadOnlyList<int> ClearHeightsCm
) : ICommand<bool>;
