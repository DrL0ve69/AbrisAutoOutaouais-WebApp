namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAllBookings;

/// <summary>Réservation vue par l'administration (avec le nom et le courriel du client).</summary>
public sealed record AdminBookingDto(
    Guid Id,
    string CustomerName,
    string CustomerEmail,
    DateTime SlotStart,
    DateTime SlotEnd,
    string Type,
    string Status,
    string AddressSummary,
    DateTime CreatedAt);
