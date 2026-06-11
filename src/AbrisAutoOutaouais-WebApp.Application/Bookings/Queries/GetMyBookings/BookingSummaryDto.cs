namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetMyBookings;

/// <summary>Résumé d'une réservation pour la liste « Mes réservations ».</summary>
public sealed record BookingSummaryDto(
    Guid Id,
    DateTime SlotStart,
    int DurationMin,
    string Type,
    string Status,
    string City);
