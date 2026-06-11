using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetAllOrders;

internal sealed class GetAllOrdersQueryHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : IQueryHandler<GetAllOrdersQuery, IReadOnlyList<AdminOrderDto>>
{
    public async Task<IReadOnlyList<AdminOrderDto>> HandleAsync(GetAllOrdersQuery query, CancellationToken ct)
    {
        var rows = await db.Orders
            .AsNoTracking()
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.CustomerId,
                o.CreatedAt,
                o.Status,
                o.TotalAmount,
                ItemCount = o.Lines.Count,
            })
            .ToListAsync(ct);

        // Résolution des courriels clients (peu de clients distincts en pratique).
        var emails = new Dictionary<Guid, string>();
        foreach (var customerId in rows.Select(r => r.CustomerId).Distinct())
        {
            var profile = await identity.GetProfileAsync(customerId, ct);
            emails[customerId] = profile?.Email ?? "—";
        }

        return rows
            .Select(o => new AdminOrderDto(
                o.Id,
                "CMD-" + o.Id.ToString("N")[..8].ToUpperInvariant(),
                emails[o.CustomerId],
                o.CreatedAt,
                o.Status.ToString(),
                o.TotalAmount,
                o.ItemCount))
            .ToList();
    }

    public ValueTask<IReadOnlyList<AdminOrderDto>> Handle(GetAllOrdersQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
