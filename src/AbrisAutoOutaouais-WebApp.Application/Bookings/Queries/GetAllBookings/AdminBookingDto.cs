namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAllBookings;

/// <summary>
/// Réservation vue par l'administration (avec le nom et le courriel du client).
/// <see cref="PaymentReference"/> est la référence du virement Interac à réconcilier (null pour les
/// réservations antérieures à EPIC 7.3) ; <see cref="PaymentConfirmedAt"/> est l'horodatage de
/// confirmation du paiement (null tant qu'il n'est pas réconcilié) ; <see cref="Amount"/> est le
/// montant forfaitaire facturé. Calque <c>AdminRentalDto</c>.
/// </summary>
public sealed record AdminBookingDto(
    Guid Id,
    string CustomerName,
    string CustomerEmail,
    DateTime SlotStart,
    DateTime SlotEnd,
    string Type,
    string Status,
    string AddressSummary,
    DateTime CreatedAt,
    string? PaymentReference,
    DateTime? PaymentConfirmedAt,
    decimal Amount);
