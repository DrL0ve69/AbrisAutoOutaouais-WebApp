using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetAllOrders;

/// <summary>Toutes les commandes (réservé à l'administration), de la plus récente à la plus ancienne.</summary>
public sealed record GetAllOrdersQuery() : IQuery<IReadOnlyList<AdminOrderDto>>;
