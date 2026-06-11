using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetMyOrders;

internal sealed class GetMyOrdersQueryHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser)
    : IQueryHandler<GetMyOrdersQuery, IReadOnlyList<OrderSummaryDto>>
{
    public async Task<IReadOnlyList<OrderSummaryDto>> HandleAsync(GetMyOrdersQuery query, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        var rows = await db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new { o.Id, o.CreatedAt, o.Status, o.TotalAmount })
            .ToListAsync(ct);

        return rows
            .Select(o => new OrderSummaryDto(
                o.Id,
                "CMD-" + o.Id.ToString("N")[..8].ToUpperInvariant(),
                o.CreatedAt,
                o.Status.ToString(),
                o.TotalAmount))
            .ToList();
    }

    public ValueTask<IReadOnlyList<OrderSummaryDto>> Handle(GetMyOrdersQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
