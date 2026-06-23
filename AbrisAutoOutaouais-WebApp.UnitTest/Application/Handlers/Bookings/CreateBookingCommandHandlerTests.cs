using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Payments.Common;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Bookings;

/// <summary>
/// Résolution du CustomerId dans CreateBooking : connecté → son Id (express jamais appelé) ;
/// visiteur avec contact → Id du compte express ; sinon règle métier (Épic F). Couvre aussi le
/// paiement (virement Interac, EPIC 7.3 : réf attachée + instructions retournées + PendingPayment).
/// </summary>
public sealed class CreateBookingCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ICurrentUserService _currentUser = Substitute.For<ICurrentUserService>();
    private readonly IExpressAccountService _express = Substitute.For<IExpressAccountService>();
    private readonly IPlacesService _places = Substitute.For<IPlacesService>();
    private readonly IPaymentService _payment = Substitute.For<IPaymentService>();
    private readonly IPaymentReferenceGenerator _paymentRefs = Substitute.For<IPaymentReferenceGenerator>();

    public CreateBookingCommandHandlerTests()
    {
        // Courriel par défaut du connecté (utilisé pour les instructions de virement) ; surchargé à
        // null dans le test « invité » pour exercer le repli sur le courriel du contact.
        _currentUser.Email.Returns("client@test.com");

        // Le double imite le fournisseur PAR DÉFAUT (virement Interac manuel) : une référence non vide
        // + des instructions e-Transfer au format canonique (L-011).
        _paymentRefs.Generate().Returns(_ => $"ABR-{Guid.NewGuid():N}"[..16]);
        _payment.InitiateAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(call => new PaymentInstructionsResult(
                Reference: call.ArgAt<string>(0),
                RecipientEmail: "paiements@abristempo-local.example",
                Amount: call.ArgAt<decimal>(1),
                Instructions: "Faites un virement Interac."));
    }

    private CreateBookingCommandHandler CreateHandler()
        => new(_db, _currentUser, _express, _places, _payment, _paymentRefs);

    // Créneau futur aligné (10 h UTC un jour ouvré dans ~40 jours), pour passer les invariants de l'agrégat.
    private static DateTime FutureSlot()
    {
        var day = DateTime.UtcNow.Date.AddDays(40);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return new DateTime(day.Year, day.Month, day.Day, 10, 0, 0, DateTimeKind.Utc);
    }

    private static CreateBookingCommand Command(
        GuestContact? guest = null, Guid? targetCustomerId = null) => new(
        SlotStart: FutureSlot(),
        Type: BookingType.Installation,
        Address: new AddressDto("123", "rue des Érables", null, "Gatineau", "QC", "J8X 1A1", "Canada"),
        Notes: null,
        Brand: null,
        Model: null,
        GuestContact: guest,
        TargetCustomerId: targetCustomerId);

    [Fact]
    public async Task Handle_AuthenticatedUser_UsesUserIdAndSkipsExpress()
    {
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);

        var id = (await CreateHandler().HandleAsync(
            Command(), TestContext.Current.CancellationToken)).BookingId;

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.CustomerId.Should().Be(userId);
        await _express.DidNotReceiveWithAnyArgs()
            .FindOrCreateByEmailAsync(Arg.Any<GuestContact>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_GuestWithContact_ResolvesCustomerViaExpressService()
    {
        var expressId = Guid.NewGuid();
        _currentUser.UserId.Returns((Guid?)null);
        _currentUser.Email.Returns((string?)null);   // visiteur → repli sur le courriel du contact invité
        var contact = new GuestContact("Jean", "Tremblay", "jean@test.com", null);
        _express.FindOrCreateByEmailAsync(contact, Arg.Any<CancellationToken>()).Returns(expressId);

        var id = (await CreateHandler().HandleAsync(
            Command(contact), TestContext.Current.CancellationToken)).BookingId;

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.CustomerId.Should().Be(expressId);
    }

    [Fact]
    public async Task Handle_StaffWithTargetCustomer_UsesTargetIdAndSkipsExpress()
    {
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        _currentUser.UserId.Returns(adminId);
        _currentUser.IsInRole(Roles.Admin).Returns(true);

        var id = (await CreateHandler().HandleAsync(
            Command(targetCustomerId: targetId), TestContext.Current.CancellationToken)).BookingId;

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.CustomerId.Should().Be(targetId);
        await _express.DidNotReceiveWithAnyArgs()
            .FindOrCreateByEmailAsync(Arg.Any<GuestContact>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_NonStaffWithTargetCustomer_IgnoresTargetAndUsesOwnId()
    {
        // Décision propriétaire : un TargetCustomerId envoyé par un appelant NON staff est ignoré
        // EN SILENCE (pas d'exception) → repli sur l'utilisateur courant. C'est la barrière de sécurité.
        var ownId = Guid.NewGuid();
        var otherCustomerId = Guid.NewGuid();
        _currentUser.UserId.Returns(ownId);
        _currentUser.IsInRole(Roles.Staff).Returns(false);
        _currentUser.IsInRole(Roles.Admin).Returns(false);

        var id = (await CreateHandler().HandleAsync(
            Command(targetCustomerId: otherCustomerId), TestContext.Current.CancellationToken)).BookingId;

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.CustomerId.Should().Be(ownId);
        booking.CustomerId.Should().NotBe(otherCustomerId);
    }

    [Fact]
    public async Task Handle_GeocodeSucceeds_PersistsLatLng()
    {
        // US-11.3 : géocodage à la création → coordonnées stockées sur le BookingSlot. Le double
        // imite le provider PAR DÉFAUT (Photon) qui renvoie un couple (lat, lng) (L-011).
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);
        _places.GeocodeAsync(
                Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns<(double Lat, double Lng)?>((45.4765, -75.7013));

        var id = (await CreateHandler().HandleAsync(
            Command(), TestContext.Current.CancellationToken)).BookingId;

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.Lat.Should().Be(45.4765);
        booking.Lng.Should().Be(-75.7013);
    }

    [Fact]
    public async Task Handle_GeocodeReturnsNull_StillCreatesBookingWithoutCoordinates()
    {
        // Résilience (US-11.3) : géocodage introuvable/échoué → null, le RDV est tout de même créé
        // (il sera simplement exclu de l'optimisation de tournée, pas de blocage de la réservation).
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);
        _places.GeocodeAsync(
                Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns((((double, double)?)null));

        var id = (await CreateHandler().HandleAsync(
            Command(), TestContext.Current.CancellationToken)).BookingId;

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.CustomerId.Should().Be(userId);
        booking.Lat.Should().BeNull();
        booking.Lng.Should().BeNull();
    }

    [Fact]
    public async Task Handle_NeitherAuthenticatedNorContact_ThrowsBusinessRule()
    {
        _currentUser.UserId.Returns((Guid?)null);

        var act = async () => await CreateHandler().HandleAsync(
            Command(), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    // ── Paiement (virement Interac) — EPIC 7.3 ──────────────────────────────────

    [Fact]
    public async Task Handle_AttachesPaymentReference_InitiatesPayment_AndKeepsBookingPendingPayment()
    {
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);

        var result = await CreateHandler().HandleAsync(
            Command(), TestContext.Current.CancellationToken);

        // La réponse porte les instructions de paiement au format canonique (référence non vide).
        result.Payment.Reference.Should().NotBeNullOrWhiteSpace();
        result.Payment.RecipientEmail.Should().Be("paiements@abristempo-local.example");
        // Montant FORFAITAIRE du type Installation (barème de domaine).
        result.Payment.Amount.Should().Be(150.00m);

        // La référence est attachée à l'agrégat ET la réservation reste en attente de paiement.
        var booking = await _db.BookingSlots.FindAsync(
            [result.BookingId], TestContext.Current.CancellationToken);
        booking!.Status.Should().Be(BookingStatus.PendingPayment);
        booking.Amount.Should().Be(150.00m);
        booking.Payment.Should().NotBeNull();
        booking.Payment!.Reference.Should().Be(result.Payment.Reference);
        booking.Payment.ConfirmedAt.Should().BeNull();

        // Le port de paiement a bien été initié avec la référence générée et le montant forfaitaire.
        await _payment.Received(1).InitiateAsync(
            booking.Payment.Reference, 150.00m, "client@test.com", Arg.Any<CancellationToken>());
    }

    [Theory] // Barème forfaitaire par type (EPIC 7.3) : le montant snapshoté suit BookingPricing.ForType.
    [InlineData(BookingType.Installation, 150)]
    [InlineData(BookingType.Delivery, 75)]
    [InlineData(BookingType.Removal, 100)]
    public async Task Handle_SnapshotsAmountFromTypeTariff(BookingType type, int expected)
    {
        _currentUser.UserId.Returns(Guid.NewGuid());

        var command = Command() with { Type = type };
        var result = await CreateHandler().HandleAsync(command, TestContext.Current.CancellationToken);

        result.Payment.Amount.Should().Be(expected);
        var booking = await _db.BookingSlots.FindAsync(
            [result.BookingId], TestContext.Current.CancellationToken);
        booking!.Amount.Should().Be(expected);
    }

    public void Dispose() => _db.Dispose();
}
