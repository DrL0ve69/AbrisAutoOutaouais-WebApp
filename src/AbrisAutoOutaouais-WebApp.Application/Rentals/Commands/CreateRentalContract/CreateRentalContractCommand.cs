using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;

/// <summary>
/// Crée un contrat de location pour un abri louable.
/// <paramref name="GuestContact"/> non nul = visiteur non connecté (compte express créé/réutilisé) ;
/// null = utilisateur connecté. Dernier paramètre (défaut null) pour ne pas casser les appels existants.
/// </summary>
public sealed record CreateRentalContractCommand(
    Guid ProductId,
    DateOnly StartDate,
    DateOnly EndDate,
    AddressDto Address,
    GuestContact? GuestContact = null) : ICommand<Guid>;
