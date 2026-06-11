using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Domain.Entities;
using Domain.ValueObjects;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

/// <summary>
/// Crée un <see cref="BookingSlot"/> en attente pour l'utilisateur courant.
/// <c>HandleAsync</c> est appelé par le Dispatcher ; <c>Handle</c> satisfait le contrat et délègue.
/// </summary>
internal sealed class CreateBookingCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : ICommandHandler<CreateBookingCommand, Guid>
{
    private const int DurationMin = 120;

    public async Task<Guid> HandleAsync(CreateBookingCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        var address = Address.Create(
            cmd.Address.Street,
            cmd.Address.City,
            string.IsNullOrWhiteSpace(cmd.Address.Province) ? "QC" : cmd.Address.Province,
            cmd.Address.PostalCode,
            string.IsNullOrWhiteSpace(cmd.Address.Country) ? "Canada" : cmd.Address.Country);

        // Règles métier (créneau futur, durée positive) dans BookingSlot.Create()
        var booking = BookingSlot.Create(userId, cmd.SlotStart, DurationMin, cmd.Type, address, notes: cmd.Notes);

        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync(ct);

        return booking.Id;
    }

    public ValueTask<Guid> Handle(CreateBookingCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
