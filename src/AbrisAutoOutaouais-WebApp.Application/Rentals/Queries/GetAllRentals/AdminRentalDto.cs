namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetAllRentals;

/// <summary>
/// Contrat de location vu par l'administration (avec le nom et le courriel du client).
/// <see cref="PaymentReference"/> est la référence du virement Interac à réconcilier (null pour les
/// contrats antérieurs à EPIC 7.2) ; <see cref="PaymentConfirmedAt"/> est l'horodatage de confirmation
/// du paiement (null tant qu'il n'est pas réconcilié). Calque <c>AdminOrderDto</c>.
/// </summary>
public sealed record AdminRentalDto(
    Guid Id,
    string CustomerName,
    string CustomerEmail,
    string ProductName,
    decimal MonthlyRate,
    DateOnly StartDate,
    DateOnly EndDate,
    string Status,
    string AddressSummary,
    DateTime CreatedAt,
    string? PaymentReference,
    DateTime? PaymentConfirmedAt);
