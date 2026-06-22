using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Domain.ValueObjects;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

/// <summary>
/// Crée un <see cref="BookingSlot"/> en attente pour l'utilisateur courant.
/// <c>HandleAsync</c> est appelé par le Dispatcher ; <c>Handle</c> satisfait le contrat et délègue.
/// </summary>
internal sealed class CreateBookingCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IExpressAccountService express,
    IPlacesService places) : ICommandHandler<CreateBookingCommand, Guid>
{
    private const int DurationMin = 120;

    public async Task<Guid> HandleAsync(CreateBookingCommand cmd, CancellationToken ct)
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

        // Règles métier (créneau futur, durée positive, exclusion ShelterLogic) dans BookingSlot.Create()
        var booking = BookingSlot.Create(
            userId, cmd.SlotStart, DurationMin, cmd.Type, address,
            notes: cmd.Notes, brand: cmd.Brand, model: cmd.Model,
            lat: coords?.Lat, lng: coords?.Lng);

        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync(ct);

        return booking.Id;
    }

    public ValueTask<Guid> Handle(CreateBookingCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
