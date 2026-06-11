using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Enums;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

/// <summary>Réserver un créneau d'installation / livraison / démontage.</summary>
public sealed record CreateBookingCommand(
    DateTime SlotStart,
    BookingType Type,
    AddressDto Address,
    string? Notes) : ICommand<Guid>;
