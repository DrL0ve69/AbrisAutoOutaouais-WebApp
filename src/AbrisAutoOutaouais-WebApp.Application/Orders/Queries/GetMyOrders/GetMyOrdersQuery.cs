using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetMyOrders;

/// <summary>Commandes de l'utilisateur connecté, de la plus récente à la plus ancienne.</summary>
public sealed record GetMyOrdersQuery() : IQuery<IReadOnlyList<OrderSummaryDto>>;
