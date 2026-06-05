using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAvailableSlots;

internal sealed class GetAvailableSlotsQueryHandler(
    IApplicationDbContext db,
    IDateTimeProvider clock) : IQueryHandler<GetAvailableSlotsQuery, IReadOnlyList<AvailableSlotDto>>
{
    private static readonly TimeSpan WorkStart = TimeSpan.FromHours(8);
    private static readonly TimeSpan WorkEnd = TimeSpan.FromHours(17);
    private static readonly TimeSpan SlotDuration = TimeSpan.FromHours(2);

    public async ValueTask<IReadOnlyList<AvailableSlotDto>> Handle(
        GetAvailableSlotsQuery query, CancellationToken ct)
    {
        var fromUtc = query.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toUtc = query.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        // Créneaux déjà réservés dans la période
        var booked = await db.BookingSlots
            .AsNoTracking()
            .Where(b =>
                b.Status != BookingStatus.Cancelled &&
                b.SlotStart >= fromUtc &&
                b.SlotStart <= toUtc)
            .Select(b => new { b.SlotStart, b.DurationMin })
            .ToListAsync(ct);

        // Générer tous les créneaux de 2h et filtrer ceux qui sont pris
        var slots = new List<AvailableSlotDto>();
        for (var day = query.From; day <= query.To; day = day.AddDays(1))
        {
            if (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;

            var dayStart = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) + WorkStart;
            var dayEnd = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) + WorkEnd;

            for (var slot = dayStart; slot + SlotDuration <= dayEnd; slot += SlotDuration)
            {
                var slotEnd = slot + SlotDuration;
                var isBooked = booked.Any(b =>
                    b.SlotStart < slotEnd &&
                    b.SlotStart.AddMinutes(b.DurationMin) > slot);

                if (!isBooked && slot > clock.UtcNow)
                    slots.Add(new AvailableSlotDto(slot, slotEnd));
            }
        }

        return slots.AsReadOnly();
    }
}
