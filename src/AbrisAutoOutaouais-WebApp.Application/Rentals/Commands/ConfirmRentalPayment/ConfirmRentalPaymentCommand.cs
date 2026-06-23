using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.ConfirmRentalPayment;

/// <summary>
/// Réconciliation administrative d'un paiement (virement Interac) reçu pour un contrat de location :
/// ACTIVE le contrat. Action Admin — l'administration vérifie la réception du virement (référence
/// <c>Payment_Reference</c>) puis confirme. <c>RentalContract.Activate</c> confirme le paiement et
/// active le contrat ; un 2ᵉ appel sur un contrat déjà confirmé lève proprement (idempotence, L-046).
/// Calque <c>ConfirmOrderPaymentCommand</c>.
/// </summary>
public sealed record ConfirmRentalPaymentCommand(Guid RentalId) : ICommand<bool>;

internal sealed class ConfirmRentalPaymentCommandHandler(
    IApplicationDbContext db,
    IDateTimeProvider clock) : ICommandHandler<ConfirmRentalPaymentCommand, bool>
{
    public async Task<bool> HandleAsync(ConfirmRentalPaymentCommand cmd, CancellationToken ct)
    {
        var contract = await db.RentalContracts
            .FirstOrDefaultAsync(r => r.Id == cmd.RentalId, ct)
            ?? throw new NotFoundException(nameof(RentalContract), cmd.RentalId);

        // Règle métier (paiement attaché, statut PendingPayment → idempotence) dans l'agrégat.
        contract.Activate(clock.UtcNow);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(ConfirmRentalPaymentCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
