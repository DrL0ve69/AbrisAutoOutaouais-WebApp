using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Payments.Common;
using AbrisAutoOutaouais_WebApp.Domain.Enums;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

/// <summary>
/// Réserver un créneau d'installation / livraison / démontage.
/// <paramref name="GuestContact"/> non nul = visiteur non connecté (compte express créé/réutilisé) ;
/// null = utilisateur connecté. Dernier paramètre (défaut null) pour ne pas casser les appels existants.
/// <paramref name="TargetCustomerId"/> : rattacher le RDV à un client existant — N'EST HONORÉ que si
/// l'appelant est Staff/Admin (calendrier admin, US-11.2) ; pour tout autre appelant il est ignoré
/// EN SILENCE (repli sur GuestContact/utilisateur courant), pas d'exception (décision propriétaire).
/// </summary>
public sealed record CreateBookingCommand(
    DateTime SlotStart,
    BookingType Type,
    AddressDto Address,
    string? Notes,
    string? Brand = null,
    string? Model = null,
    GuestContact? GuestContact = null,
    Guid? TargetCustomerId = null) : ICommand<CreateBookingResult>;

/// <summary>
/// Résultat de la création d'une réservation : l'identifiant du créneau créé et les instructions de
/// paiement (virement Interac) à présenter au client. La réservation reste <c>PendingPayment</c>
/// jusqu'à la réconciliation du paiement par l'administration. Calque <c>CreateRentalContractResult</c>.
/// </summary>
public sealed record CreateBookingResult(Guid BookingId, PaymentInstructionsResult Payment);
