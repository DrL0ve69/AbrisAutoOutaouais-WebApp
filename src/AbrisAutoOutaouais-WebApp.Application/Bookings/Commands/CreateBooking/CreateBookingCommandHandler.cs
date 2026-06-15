using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
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
    IExpressAccountService express) : ICommandHandler<CreateBookingCommand, Guid>
{
    private const int DurationMin = 120;

    public async Task<Guid> HandleAsync(CreateBookingCommand cmd, CancellationToken ct)
    {
        // Utilisateur connecté → son Id ; sinon visiteur → compte express trouvé-ou-créé par courriel.
        var userId = currentUser.UserId
            ?? (cmd.GuestContact is not null
                ? await express.FindOrCreateByEmailAsync(cmd.GuestContact, ct)
                : throw new BusinessRuleException("Coordonnées requises pour réserver un créneau."));

        var address = Address.Create(
            cmd.Address.CivicNumber,
            cmd.Address.Street,
            cmd.Address.Apartment,
            cmd.Address.City,
            string.IsNullOrWhiteSpace(cmd.Address.Province) ? "QC" : cmd.Address.Province,
            cmd.Address.PostalCode,
            string.IsNullOrWhiteSpace(cmd.Address.Country) ? "Canada" : cmd.Address.Country);

        // Règles métier (créneau futur, durée positive, exclusion ShelterLogic) dans BookingSlot.Create()
        var booking = BookingSlot.Create(
            userId, cmd.SlotStart, DurationMin, cmd.Type, address,
            notes: cmd.Notes, brand: cmd.Brand, model: cmd.Model);

        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync(ct);

        return booking.Id;
    }

    public ValueTask<Guid> Handle(CreateBookingCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
