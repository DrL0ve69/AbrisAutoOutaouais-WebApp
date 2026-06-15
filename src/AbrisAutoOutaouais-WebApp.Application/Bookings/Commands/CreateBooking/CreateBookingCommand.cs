using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Domain.Enums;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

/// <summary>
/// Réserver un créneau d'installation / livraison / démontage.
/// <paramref name="GuestContact"/> non nul = visiteur non connecté (compte express créé/réutilisé) ;
/// null = utilisateur connecté. Dernier paramètre (défaut null) pour ne pas casser les appels existants.
/// </summary>
public sealed record CreateBookingCommand(
    DateTime SlotStart,
    BookingType Type,
    AddressDto Address,
    string? Notes,
    string? Brand = null,
    string? Model = null,
    GuestContact? GuestContact = null) : ICommand<Guid>;
