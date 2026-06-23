using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using Domain.Entities;
using Domain.ValueObjects;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

/// <summary>
/// Crée un <see cref="BookingSlot"/> EN ATTENTE DE PAIEMENT pour l'utilisateur courant et renvoie les
/// instructions de paiement (virement Interac) à présenter au client. La réservation n'est CONFIRMÉE
/// qu'après réconciliation administrative du paiement (<c>ConfirmBookingPaymentCommand</c>). Calque
/// <c>CreateRentalContractCommandHandler</c>. <c>HandleAsync</c> est appelé par le Dispatcher ;
/// <c>Handle</c> satisfait le contrat et délègue.
/// </summary>
internal sealed class CreateBookingCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IExpressAccountService express,
    IPlacesService places,
    IPaymentService payment,
    IPaymentReferenceGenerator paymentReferences) : ICommandHandler<CreateBookingCommand, CreateBookingResult>
{
    private const int DurationMin = 120;

    public async Task<CreateBookingResult> HandleAsync(CreateBookingCommand cmd, CancellationToken ct)
    {
        // Résolution sécurisée du client rattaché au RDV, par ordre de priorité :
        //   1) Staff/Admin ciblant un client existant (calendrier admin, US-11.2) → ce client.
        //      TargetCustomerId d'un appelant NON staff est ignoré EN SILENCE (repli) — décision
        //      propriétaire, pas de ForbiddenException ; la garde isStaff est la barrière.
        //   2) Visiteur fournissant un contact → compte express trouvé-ou-créé par courriel.
        //   3) Utilisateur connecté → son propre Id.
        var isStaff = currentUser.IsInRole(Roles.Staff) || currentUser.IsInRole(Roles.Admin);
        var userId =
            (isStaff && cmd.TargetCustomerId is { } target && target != Guid.Empty) ? target
            : cmd.GuestContact is not null
                ? await express.FindOrCreateByEmailAsync(cmd.GuestContact, ct)
                : currentUser.UserId
                    ?? throw new BusinessRuleException("Coordonnées requises pour réserver un créneau.");

        var address = Address.Create(
            cmd.Address.CivicNumber,
            cmd.Address.Street,
            cmd.Address.Apartment,
            cmd.Address.City,
            string.IsNullOrWhiteSpace(cmd.Address.Province) ? "QC" : cmd.Address.Province,
            cmd.Address.PostalCode,
            string.IsNullOrWhiteSpace(cmd.Address.Country) ? "Canada" : cmd.Address.Country);

        // Géocodage du lieu du RDV pour l'optimisation de tournée (US-11.3). RÉSILIENT : le port ne
        // lève jamais ; null si introuvable/échec → le RDV est tout de même créé (sans coordonnées il
        // sera simplement exclu de l'optimisation, pas de blocage de la réservation).
        var coords = await places.GeocodeAsync(
            address.CivicNumber, address.Street, address.City, address.Province, ct);

        // Montant FORFAITAIRE snapshoté à partir du type (barème de domaine, EPIC 7.3 — pas de
        // if/else dans le handler : la règle vit dans BookingPricing).
        var amount = BookingPricing.ForType(cmd.Type);

        // Règles métier (créneau futur, durée positive, exclusion ShelterLogic) dans BookingSlot.Create().
        // La réservation est créée EN ATTENTE DE PAIEMENT (PendingPayment).
        var booking = BookingSlot.Create(
            userId, cmd.SlotStart, DurationMin, cmd.Type, address,
            notes: cmd.Notes, brand: cmd.Brand, model: cmd.Model,
            lat: coords?.Lat, lng: coords?.Lng, amount: amount);

        // ── Paiement (virement Interac) ────────────────────────────────────────
        // Réf NON DEVINABLE attachée à l'agrégat (statut porté par BookingSlot.Payment). La réservation
        // reste PendingPayment : la confirmation passe par la réconciliation admin (confirm-payment).
        // Courriel du CLIENT : celui du connecté, sinon celui du contact invité (comme la location).
        var customerEmail = currentUser.Email ?? cmd.GuestContact!.Email;
        var reference = paymentReferences.Generate();
        booking.AttachPaymentReference(reference);

        // Port résilient (jamais d'exception réseau, comme IPlacesService) : pas de try/catch ici.
        var instructions = await payment.InitiateAsync(reference, amount, customerEmail, ct);

        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync(ct);

        return new CreateBookingResult(booking.Id, instructions);
    }

    public ValueTask<CreateBookingResult> Handle(CreateBookingCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
