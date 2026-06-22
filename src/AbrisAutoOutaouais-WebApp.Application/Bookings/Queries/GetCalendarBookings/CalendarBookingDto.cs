namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;

/// <summary>
/// Réservation projetée pour une cellule de calendrier (vue planning, lecture seule).
/// DTO léger : pas d'adresse complète ni de courriel, seulement ce qu'une cellule affiche
/// (le client, la ville, le type et le statut). Les bornes du créneau sont en UTC.
/// </summary>
public sealed record CalendarBookingDto(
    Guid Id,
    DateTime SlotStart,
    DateTime SlotEnd,
    string Type,
    string Status,
    string CustomerName,
    string City);
