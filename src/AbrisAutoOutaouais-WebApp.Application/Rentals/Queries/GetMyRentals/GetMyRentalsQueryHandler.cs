using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetMyRentals;

internal sealed class GetMyRentalsQueryHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser)
    : IQueryHandler<GetMyRentalsQuery, IReadOnlyList<RentalSummaryDto>>
{
    public async Task<IReadOnlyList<RentalSummaryDto>> HandleAsync(GetMyRentalsQuery query, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        var rows = await db.RentalContracts
            .AsNoTracking()
            .Where(r => r.CustomerId == userId)
            .OrderByDescending(r => r.StartDate)
            .Select(r => new
            {
                r.Id,
                r.ProductName,
                r.MonthlyRate,
                r.StartDate,
                r.EndDate,
                r.Status,
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new RentalSummaryDto(
                r.Id,
                r.ProductName,
                r.MonthlyRate,
                r.StartDate,
                r.EndDate,
                r.Status.ToString()))
            .ToList();
    }

    public ValueTask<IReadOnlyList<RentalSummaryDto>> Handle(GetMyRentalsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
