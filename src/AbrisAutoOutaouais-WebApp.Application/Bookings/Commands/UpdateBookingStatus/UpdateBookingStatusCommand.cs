using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.UpdateBookingStatus;

/// <summary>Corps de l'endpoint admin POST /bookings/{id}/status.</summary>
public sealed record UpdateBookingStatusRequest(string Action);

/// <summary>Fait avancer (ou annule) le statut d'une réservation — action métier de l'agrégat <see cref="BookingSlot"/>.</summary>
public sealed record UpdateBookingStatusCommand(Guid BookingId, string Action) : ICommand<bool>;

internal sealed class UpdateBookingStatusCommandHandler(IApplicationDbContext db)
    : ICommandHandler<UpdateBookingStatusCommand, bool>
{
    public async Task<bool> HandleAsync(UpdateBookingStatusCommand cmd, CancellationToken ct)
    {
        var booking = await db.BookingSlots
            .FirstOrDefaultAsync(b => b.Id == cmd.BookingId, ct)
            ?? throw new NotFoundException(nameof(BookingSlot), cmd.BookingId);

        switch (cmd.Action?.Trim().ToLowerInvariant())
        {
            case "confirm": booking.Confirm(); break;
            case "complete": booking.Complete(); break;
            case "cancel": booking.Cancel(); break;
            default:
                throw new BusinessRuleException($"Action de réservation inconnue : « {cmd.Action} ».");
        }

        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(UpdateBookingStatusCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
