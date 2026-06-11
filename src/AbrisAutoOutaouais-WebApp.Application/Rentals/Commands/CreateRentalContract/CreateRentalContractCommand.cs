using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;

/// <summary>Crée un contrat de location pour un abri louable.</summary>
public sealed record CreateRentalContractCommand(
    Guid ProductId,
    DateOnly StartDate,
    DateOnly EndDate,
    AddressDto Address) : ICommand<Guid>;
