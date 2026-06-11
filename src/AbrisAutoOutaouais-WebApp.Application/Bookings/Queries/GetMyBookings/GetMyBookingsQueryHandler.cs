using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetMyBookings;

internal sealed class GetMyBookingsQueryHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser)
    : IQueryHandler<GetMyBookingsQuery, IReadOnlyList<BookingSummaryDto>>
{
    public async Task<IReadOnlyList<BookingSummaryDto>> HandleAsync(GetMyBookingsQuery query, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        var rows = await db.BookingSlots
            .AsNoTracking()
            .Where(b => b.CustomerId == userId)
            .OrderByDescending(b => b.SlotStart)
            .Select(b => new
            {
                b.Id,
                b.SlotStart,
                b.DurationMin,
                b.Type,
                b.Status,
                City = b.Address.City,
            })
            .ToListAsync(ct);

        return rows
            .Select(b => new BookingSummaryDto(
                b.Id,
                b.SlotStart,
                b.DurationMin,
                b.Type.ToString(),
                b.Status.ToString(),
                b.City))
            .ToList();
    }

    public ValueTask<IReadOnlyList<BookingSummaryDto>> Handle(GetMyBookingsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
