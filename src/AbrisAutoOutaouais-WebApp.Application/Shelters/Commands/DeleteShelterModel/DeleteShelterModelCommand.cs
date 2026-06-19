using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.DeleteShelterModel;

/// <summary>Supprime (soft-delete) un modèle d'abri paramétrique (admin, EPIC 9.5).</summary>
public sealed record DeleteShelterModelCommand(Guid Id) : ICommand<bool>;
