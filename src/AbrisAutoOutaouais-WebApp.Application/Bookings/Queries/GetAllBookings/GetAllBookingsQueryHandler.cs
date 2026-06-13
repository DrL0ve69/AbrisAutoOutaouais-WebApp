using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAllBookings;

internal sealed class GetAllBookingsQueryHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : IQueryHandler<GetAllBookingsQuery, IReadOnlyList<AdminBookingDto>>
{
    public async Task<IReadOnlyList<AdminBookingDto>> HandleAsync(GetAllBookingsQuery query, CancellationToken ct)
    {
        var rows = await db.BookingSlots
            .AsNoTracking()
            .OrderByDescending(b => b.SlotStart)
            .Select(b => new
            {
                b.Id,
                b.CustomerId,
                b.SlotStart,
                b.DurationMin,
                b.Type,
                b.Status,
                b.Address.Street,
                b.Address.City,
                b.CreatedAt,
            })
            .ToListAsync(ct);

        // Résolution des noms/courriels clients (peu de clients distincts en pratique).
        var profiles = new Dictionary<Guid, (string Name, string Email)>();
        foreach (var customerId in rows.Select(r => r.CustomerId).Distinct())
        {
            var profile = await identity.GetProfileAsync(customerId, ct);
            profiles[customerId] = profile is null
                ? ("—", "—")
                : ($"{profile.FirstName} {profile.LastName}".Trim(), profile.Email);
        }

        return rows
            .Select(b => new AdminBookingDto(
                b.Id,
                profiles[b.CustomerId].Name,
                profiles[b.CustomerId].Email,
                b.SlotStart,
                b.SlotStart.AddMinutes(b.DurationMin),
                b.Type.ToString(),
                b.Status.ToString(),
                $"{b.Street}, {b.City}",
                b.CreatedAt))
            .ToList();
    }

    public ValueTask<IReadOnlyList<AdminBookingDto>> Handle(GetAllBookingsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
