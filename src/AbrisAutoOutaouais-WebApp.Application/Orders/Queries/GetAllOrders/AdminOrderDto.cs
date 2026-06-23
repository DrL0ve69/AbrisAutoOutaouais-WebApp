namespace AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetAllOrders;

/// <summary>
/// Commande vue par l'administration (avec le courriel du client). <see cref="PaymentReference"/> est
/// la référence du virement Interac à réconcilier (null pour les commandes antérieures à EPIC 7) ;
/// <see cref="PaymentConfirmedAt"/> est l'horodatage de confirmation du paiement (null tant qu'il
/// n'est pas réconcilié).
/// </summary>
public sealed record AdminOrderDto(
    Guid Id,
    string Reference,
    string CustomerEmail,
    DateTime CreatedAt,
    string Status,
    decimal Total,
    int ItemCount,
    string? PaymentReference,
    DateTime? PaymentConfirmedAt);
