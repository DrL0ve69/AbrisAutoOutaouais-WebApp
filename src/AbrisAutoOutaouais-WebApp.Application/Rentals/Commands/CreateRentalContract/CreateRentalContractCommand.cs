using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Payments.Common;

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
    GuestContact? GuestContact = null) : ICommand<CreateRentalContractResult>;

/// <summary>
/// Résultat de la création d'un contrat de location : l'identifiant du contrat créé et les
/// instructions de paiement (virement Interac) à présenter au client. Le contrat reste
/// <c>PendingPayment</c> jusqu'à la réconciliation du paiement par l'administration. Calque
/// <c>PlaceOrderResult</c>.
/// </summary>
public sealed record CreateRentalContractResult(Guid RentalId, PaymentInstructionsResult Payment);
