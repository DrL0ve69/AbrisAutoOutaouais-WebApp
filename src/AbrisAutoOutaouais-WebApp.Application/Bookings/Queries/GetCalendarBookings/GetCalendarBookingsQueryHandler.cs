using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;

/// <summary>
/// Agrège les <c>BookingSlot</c> existants pour la vue planning (lecture seule) : aucune nouvelle
/// entité ni mécanisme de RDV. Renvoie TOUTES les réservations de la fenêtre de dates — Admin et
/// Staff voient tout (décision propriétaire US-11.1) ; le filtrage « par installateur assigné »
/// viendra avec une sous-tâche d'assignation ultérieure (FK + migration). Réutilise l'idiome de
/// <see cref="GetAllBookings.GetAllBookingsQueryHandler"/> pour la résolution du nom client.
/// </summary>
internal sealed class GetCalendarBookingsQueryHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : IQueryHandler<GetCalendarBookingsQuery, IReadOnlyList<CalendarBookingDto>>
{
    public async Task<IReadOnlyList<CalendarBookingDto>> HandleAsync(
        GetCalendarBookingsQuery query, CancellationToken ct)
    {
        var fromUtc = query.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        // Borne haute EXCLUSIVE = lendemain du dernier jour, pour inclure tout le jour To.
        var toExclusiveUtc = query.To.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Fenêtre par DÉBUT de créneau. Correct UNIQUEMENT parce qu'un créneau est sous-journalier
        // (SlotRules.SlotDuration = 2 h, < 24 h) : aucun créneau ne peut commencer avant `fromUtc`
        // et déborder dans la fenêtre. Si la durée devenait multi-jours, il faudrait élargir la
        // borne basse en amont (ex. fromUtc - durée max) et filtrer sur le chevauchement réel
        // [SlotStart, SlotStart+Durée) — voir leçon L-007 (test de chevauchement de bord en garde).
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

        // Résolution des noms clients (peu de clients distincts par fenêtre en pratique).
        var names = new Dictionary<Guid, string>();
        foreach (var customerId in rows.Select(r => r.CustomerId).Distinct())
        {
            var profile = await identity.GetProfileAsync(customerId, ct);
            names[customerId] = profile is null
                ? "—"
                : $"{profile.FirstName} {profile.LastName}".Trim();
        }

        return rows
            .Select(b => new CalendarBookingDto(
                b.Id,
                b.SlotStart,
                b.SlotStart.AddMinutes(b.DurationMin),
                b.Type.ToString(),
                b.Status.ToString(),
                names[b.CustomerId],
                b.City))
            .ToList();
    }

    public ValueTask<IReadOnlyList<CalendarBookingDto>> Handle(
        GetCalendarBookingsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
