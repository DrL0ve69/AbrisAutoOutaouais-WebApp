using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CancelBooking;

public sealed record CancelBookingCommand(Guid Id) : ICommand<bool>;

internal sealed class CancelBookingCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : ICommandHandler<CancelBookingCommand, bool>
{
    public async Task<bool> HandleAsync(CancelBookingCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        // L'utilisateur ne peut annuler que SES réservations.
        var booking = await db.BookingSlots
            .FirstOrDefaultAsync(b => b.Id == cmd.Id && b.CustomerId == userId, ct)
            ?? throw new NotFoundException(nameof(BookingSlot), cmd.Id);

        booking.Cancel(); // règle métier dans l'agrégat
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(CancelBookingCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
