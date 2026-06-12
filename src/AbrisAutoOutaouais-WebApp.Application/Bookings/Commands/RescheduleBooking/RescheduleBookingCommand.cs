using AbrisAutoOutaouais_WebApp.Application.Bookings.Common;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.RescheduleBooking;

public sealed record RescheduleBookingCommand(Guid Id, DateTime NewSlotStart) : ICommand<bool>;

/// <summary>Corps de la requête HTTP — l'id vient de la route, pas du corps.</summary>
public sealed record RescheduleBookingRequest(DateTime NewSlotStart);

internal sealed class RescheduleBookingCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IDateTimeProvider clock) : ICommandHandler<RescheduleBookingCommand, bool>
{
    public async Task<bool> HandleAsync(RescheduleBookingCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        // L'utilisateur ne peut reporter que SES réservations.
        var booking = await db.BookingSlots
            .FirstOrDefaultAsync(b => b.Id == cmd.Id && b.CustomerId == userId, ct)
            ?? throw new NotFoundException(nameof(BookingSlot), cmd.Id);

        // Le créneau cible doit tomber sur la grille (jour ouvré, 08 h–17 h, bloc de 2 h).
        if (!SlotRules.IsValidSlotStart(cmd.NewSlotStart))
            throw new BusinessRuleException("Le créneau choisi n'est pas un créneau valide.");

        // … et ne pas chevaucher une AUTRE réservation active (double réservation interdite).
        // Le filtre de requête global exclut déjà les soft-deletes (ne pas .IgnoreQueryFilters()).
        // Le fenêtrage « même jour » est correct UNIQUEMENT parce que tous les créneaux durent 2 h
        // (sous-journée) : si des durées multi-jours apparaissaient, élargir la fenêtre (AddDays(-1)).
        var dayStart = cmd.NewSlotStart.Date;
        var sameDay = await db.BookingSlots.AsNoTracking()
            .Where(b => b.Id != booking.Id
                && b.Status != BookingStatus.Cancelled
                && b.SlotStart >= dayStart && b.SlotStart < dayStart.AddDays(1))
            .Select(b => new { b.SlotStart, b.DurationMin })
            .ToListAsync(ct);

        var taken = sameDay.Any(b =>
            SlotRules.Overlaps(cmd.NewSlotStart, booking.DurationMin, b.SlotStart, b.DurationMin));
        if (taken)
            throw new BusinessRuleException("Ce créneau est déjà réservé.");

        booking.Reschedule(cmd.NewSlotStart, clock.UtcNow); // futur + statut (règle métier)
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(RescheduleBookingCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
