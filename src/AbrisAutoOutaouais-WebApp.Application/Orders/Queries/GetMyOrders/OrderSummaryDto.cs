namespace AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetMyOrders;

/// <summary>Résumé d'une commande pour la liste « Mes commandes ».</summary>
public sealed record OrderSummaryDto(
    Guid Id,
    string Reference,
    DateTime CreatedAt,
    string Status,
    decimal Total);
