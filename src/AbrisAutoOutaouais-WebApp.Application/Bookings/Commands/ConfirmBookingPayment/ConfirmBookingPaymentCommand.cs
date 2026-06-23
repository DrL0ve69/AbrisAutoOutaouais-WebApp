using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.ConfirmBookingPayment;

/// <summary>
/// Réconciliation administrative d'un paiement (virement Interac) reçu pour une réservation : ACTIVE
/// la réservation. Action Admin — l'administration vérifie la réception du virement (référence
/// <c>Payment_Reference</c>) puis confirme. <c>BookingSlot.Activate</c> confirme le paiement et passe
/// le statut à Confirmed ; un 2ᵉ appel sur une réservation déjà confirmée lève proprement (idempotence,
/// L-046). Calque <c>ConfirmRentalPaymentCommand</c>.
/// </summary>
public sealed record ConfirmBookingPaymentCommand(Guid BookingId) : ICommand<bool>;

internal sealed class ConfirmBookingPaymentCommandHandler(
    IApplicationDbContext db,
    IDateTimeProvider clock) : ICommandHandler<ConfirmBookingPaymentCommand, bool>
{
    public async Task<bool> HandleAsync(ConfirmBookingPaymentCommand cmd, CancellationToken ct)
    {
        var booking = await db.BookingSlots
            .FirstOrDefaultAsync(b => b.Id == cmd.BookingId, ct)
            ?? throw new NotFoundException(nameof(BookingSlot), cmd.BookingId);

        // Règle métier (paiement attaché, statut PendingPayment → idempotence) dans l'agrégat.
        booking.Activate(clock.UtcNow);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(ConfirmBookingPaymentCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
