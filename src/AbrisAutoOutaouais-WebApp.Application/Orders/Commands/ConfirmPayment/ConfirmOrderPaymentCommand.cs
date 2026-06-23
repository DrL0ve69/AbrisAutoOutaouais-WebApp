using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.ConfirmPayment;

/// <summary>
/// Réconciliation administrative d'un paiement (virement Interac) reçu : marque la commande comme
/// PAYÉE. Action Admin — l'administration vérifie la réception du virement (référence
/// <c>Payment_Reference</c>) puis confirme. <c>Order.MarkPaid</c> confirme le paiement et la
/// commande ; un 2ᵉ appel sur une commande déjà confirmée lève proprement (idempotence, L-046).
/// </summary>
public sealed record ConfirmOrderPaymentCommand(Guid OrderId) : ICommand<bool>;

internal sealed class ConfirmOrderPaymentCommandHandler(
    IApplicationDbContext db,
    IDateTimeProvider clock) : ICommandHandler<ConfirmOrderPaymentCommand, bool>
{
    public async Task<bool> HandleAsync(ConfirmOrderPaymentCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders
            .FirstOrDefaultAsync(o => o.Id == cmd.OrderId, ct)
            ?? throw new NotFoundException(nameof(Order), cmd.OrderId);

        // Règle métier (paiement attaché, statut Pending → idempotence) dans l'agrégat.
        order.MarkPaid(clock.UtcNow);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(ConfirmOrderPaymentCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
