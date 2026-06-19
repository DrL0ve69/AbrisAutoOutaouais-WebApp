using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.CreateShelterModel;

/// <summary>
/// Crée un modèle d'abri paramétrique (référentiel admin, EPIC 9.5).
/// <c>BasePrice</c> est en DOLLARS ; <c>PricePerArchCents</c> est en CENTS (miroir de l'entité).
/// </summary>
public sealed record CreateShelterModelCommand(
    string Slug,
    string Name,
    Guid CategoryId,
    int LengthStepCm,
    int MinLengthCm,
    int MaxLengthCm,
    decimal BasePrice,
    int PricePerArchCents,
    IReadOnlyList<int> WidthsCm,
    IReadOnlyList<int> ClearHeightsCm
) : ICommand<Guid>;
