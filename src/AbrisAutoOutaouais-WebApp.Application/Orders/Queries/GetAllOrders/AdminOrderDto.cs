namespace AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetAllOrders;

/// <summary>Commande vue par l'administration (avec le courriel du client).</summary>
public sealed record AdminOrderDto(
    Guid Id,
    string Reference,
    string CustomerEmail,
    DateTime CreatedAt,
    string Status,
    decimal Total,
    int ItemCount);
