using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Queries.GetDayDetail;

/// <summary>
/// Assemble le détail d'une journée (US-11.2) : les RDV dont le créneau DÉBUTE ce jour-là (même
/// idiome de projection que <see cref="GetCalendarBookings.GetCalendarBookingsQueryHandler"/> :
/// fenêtre par début de créneau, sous-journalière — L-007), TOUS les employés (Staff) via
/// <see cref="IIdentityService.GetStaffMembersAsync"/>, et leurs <c>WorkHoursEntry</c> pour cette
/// date. Lecture pure (<c>.AsNoTracking()</c>).
/// </summary>
internal sealed class GetDayDetailQueryHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : IQueryHandler<GetDayDetailQuery, DayDetailDto>
{
    public async Task<DayDetailDto> HandleAsync(GetDayDetailQuery query, CancellationToken ct)
    {
        var fromUtc = query.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toExclusiveUtc = query.Date.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // RDV du jour — fenêtre par début de créneau (sous-journalier, cf. L-007). Projection
        // identique au calendrier pour rester cohérent et réutiliser CalendarBookingDto.
        var rows = await db.BookingSlots
            .AsNoTracking()
            .Where(b => b.SlotStart >= fromUtc && b.SlotStart < toExclusiveUtc)
            .OrderBy(b => b.SlotStart)
            .Select(b => new
            {
                b.Id,
                b.CustomerId,
                b.SlotStart,
                b.DurationMin,
                b.Type,
                b.Status,
                b.Address.City,
            })
            .ToListAsync(ct);

        var names = new Dictionary<Guid, string>();
        foreach (var customerId in rows.Select(r => r.CustomerId).Distinct())
        {
            var profile = await identity.GetProfileAsync(customerId, ct);
            names[customerId] = profile is null
                ? "—"
                : $"{profile.FirstName} {profile.LastName}".Trim();
        }

        var bookings = rows
            .Select(b => new CalendarBookingDto(
                b.Id,
                b.SlotStart,
                b.SlotStart.AddMinutes(b.DurationMin),
                b.Type.ToString(),
                b.Status.ToString(),
                names[b.CustomerId],
                b.City))
            .ToList();

        // Tous les employés (Staff) — l'Application n'énumère JAMAIS AppUser directement (frontière).
        var staffMembers = await identity.GetStaffMembersAsync(ct);

        // Heures saisies pour CE jour, indexées par employé (au plus une ligne par couple
        // employé/date — index unique en base).
        var entries = await db.WorkHoursEntries
            .AsNoTracking()
            .Where(w => w.WorkDate == query.Date)
            .ToListAsync(ct);
        var byEmployee = entries.ToDictionary(w => w.EmployeeId);

        var staff = staffMembers
            .Select(m =>
            {
                if (byEmployee.TryGetValue(m.Id, out var entry))
                    return new StaffWorkHoursDto(
                        m.Id, m.FullName, entry.StartMinutes, entry.EndMinutes, entry.Note, HasEntry: true);
                return new StaffWorkHoursDto(m.Id, m.FullName, null, null, null, HasEntry: false);
            })
            .ToList();

        return new DayDetailDto(query.Date, bookings, staff);
    }

    public ValueTask<DayDetailDto> Handle(GetDayDetailQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
