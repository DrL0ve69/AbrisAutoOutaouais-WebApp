using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;

/// <summary>
/// Crée un contrat de location pour un MODÈLE d'abri paramétrique LOUABLE et une taille configurée.
/// <paramref name="Slug"/> identifie le modèle ; <paramref name="LengthCm"/>/<paramref name="ClearHeightCm"/>
/// la taille (validée contre la grille du modèle, comme l'achat). <paramref name="GuestContact"/> non
/// nul = visiteur non connecté (compte express créé/réutilisé) ; null = utilisateur connecté.
/// </summary>
public sealed record CreateRentalContractCommand(
    string Slug,
    int LengthCm,
    int ClearHeightCm,
    DateOnly StartDate,
    DateOnly EndDate,
    AddressDto Address,
    GuestContact? GuestContact = null) : ICommand<Guid>;
