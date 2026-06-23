using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;

/// <summary>
/// Crée un <see cref="RentalContract"/> EN ATTENTE DE PAIEMENT pour l'utilisateur courant et renvoie
/// les instructions de paiement (virement Interac) à présenter au client. Le contrat n'est ACTIF
/// qu'après réconciliation administrative du paiement (<c>ConfirmRentalPaymentCommand</c>). Calque
/// <c>PlaceOrderCommandHandler</c>. <c>HandleAsync</c> est appelé par le Dispatcher ; <c>Handle</c>
/// satisfait le contrat et délègue.
/// </summary>
internal sealed class CreateRentalContractCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IExpressAccountService express,
    IPaymentService payment,
    IPaymentReferenceGenerator paymentReferences) : ICommandHandler<CreateRentalContractCommand, CreateRentalContractResult>
{
    public async Task<CreateRentalContractResult> HandleAsync(CreateRentalContractCommand cmd, CancellationToken ct)
    {
        // Utilisateur connecté → son Id ; sinon visiteur → compte express trouvé-ou-créé par courriel.
        var userId = currentUser.UserId
            ?? (cmd.GuestContact is not null
                ? await express.FindOrCreateByEmailAsync(cmd.GuestContact, ct)
                : throw new BusinessRuleException("Coordonnées requises pour créer un contrat de location."));

        // Modèle paramétrique louable + ses collections chargées (entités RÉGULIÈRES → Include
        // explicite, L-035) : la grille (PriceEntries) et les dimensions sont nécessaires pour valider
        // la taille demandée (longueur × hauteur dégagée) dans RentalContract.CreateForModel().
        var model = await db.ShelterModels
            .Include(m => m.Dimensions)
            .Include(m => m.PriceEntries)
            .FirstOrDefaultAsync(m => m.Slug == cmd.Slug, ct)
            ?? throw new NotFoundException(nameof(ShelterModel), cmd.Slug);

        var address = Address.Create(
            cmd.Address.CivicNumber,
            cmd.Address.Street,
            cmd.Address.Apartment,
            cmd.Address.City,
            string.IsNullOrWhiteSpace(cmd.Address.Province) ? "QC" : cmd.Address.Province,
            cmd.Address.PostalCode,
            string.IsNullOrWhiteSpace(cmd.Address.Country) ? "Canada" : cmd.Address.Country);

        // Règles métier (modèle louable, taille admissible, dates cohérentes) dans CreateForModel().
        // Le contrat est créé EN ATTENTE DE PAIEMENT (PendingPayment).
        var contract = RentalContract.CreateForModel(
            userId, model, cmd.LengthCm, cmd.ClearHeightCm, cmd.StartDate, cmd.EndDate, address);

        // ── Paiement (virement Interac) ────────────────────────────────────────
        // Réf NON DEVINABLE attachée à l'agrégat (statut porté par RentalContract.Payment). Le contrat
        // reste PendingPayment : la confirmation passe par la réconciliation admin (confirm-payment).
        // Courriel du CLIENT : celui du connecté, sinon celui du contact invité (comme PlaceOrder).
        var customerEmail = currentUser.Email ?? cmd.GuestContact!.Email;
        var reference = paymentReferences.Generate();
        contract.AttachPaymentReference(reference);

        // Port résilient (jamais d'exception réseau, comme IPlacesService) : pas de try/catch ici.
        // Montant viré = TOTAL du contrat (tarif mensuel × durée), payé d'avance — décision propriétaire
        // (EPIC 7.2). Le total circule ensuite vers le panneau e-Transfer via PaymentInstructionsResult.Amount.
        var instructions = await payment.InitiateAsync(reference, contract.TotalAmount, customerEmail, ct);

        db.RentalContracts.Add(contract);
        await db.SaveChangesAsync(ct);

        return new CreateRentalContractResult(contract.Id, instructions);
    }

    public ValueTask<CreateRentalContractResult> Handle(CreateRentalContractCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
