using AbrisAutoOutaouais_WebApp.Domain.Services;
using Domain.Entities;
using Domain.ValueObjects;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Règles de l'agrégat <see cref="BookingSlot"/> :
///  - statut INITIAL « en attente de paiement » (virement Interac, EPIC 7.3) ;
///  - paiement (attache de référence + activation idempotente, L-046) qui fait passer
///    PendingPayment → Confirmed ;
///  - machine à états LEGACY (Confirm/Complete/Cancel) conservée pour l'admin ;
///  - règles de report (seule une réservation à venir est reportable, vers un créneau futur).
/// </summary>
public sealed class BookingSlotTests
{
    private static Address MakeAddress()
        => Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1");

    // Create exige un créneau futur (DateTime.UtcNow réel) → on part loin dans le futur.
    private static BookingSlot MakeBooking()
        => BookingSlot.Create(
            Guid.NewGuid(), DateTime.UtcNow.AddDays(30), 120,
            BookingType.Installation, MakeAddress());

    /// <summary>
    /// Amène une réservation neuve (PendingPayment) jusqu'au statut demandé via le flux RÉEL :
    /// Confirmed s'obtient en attachant une référence puis en activant le paiement (PendingPayment →
    /// Confirmed) ; Completed enchaîne Complete ; Cancelled annule directement.
    /// </summary>
    private static BookingSlot MakeBookingIn(BookingStatus status)
    {
        var booking = MakeBooking();
        switch (status)
        {
            case BookingStatus.Confirmed:
                booking.AttachPaymentReference("REF-BOOK-001");
                booking.Activate(DateTime.UtcNow);
                break;
            case BookingStatus.Completed:
                booking.AttachPaymentReference("REF-BOOK-001");
                booking.Activate(DateTime.UtcNow);
                booking.Complete();
                break;
            case BookingStatus.Cancelled:
                booking.Cancel();
                break;
        }
        return booking;
    }

    // ── Statut initial + barème ──────────────────────────────────────────────

    [Fact]
    public void Create_StartsPendingPayment_WithNoPaymentAttached()
    {
        var booking = MakeBooking();

        // EPIC 7.3 : une réservation naît EN ATTENTE DE PAIEMENT (virement Interac), pas Pending.
        booking.Status.Should().Be(BookingStatus.PendingPayment);
        booking.Payment.Should().BeNull();
    }

    [Fact]
    public void Create_SnapshotsAmountPassedIn()
    {
        var booking = BookingSlot.Create(
            Guid.NewGuid(), DateTime.UtcNow.AddDays(30), 120,
            BookingType.Removal, MakeAddress(), amount: 100m);

        booking.Amount.Should().Be(100m);
    }

    [Theory] // Barème forfaitaire par type (EPIC 7.3).
    [InlineData(BookingType.Installation, 150)]
    [InlineData(BookingType.Delivery, 75)]
    [InlineData(BookingType.Removal, 100)]
    public void BookingPricing_ForType_ReturnsFlatTariff(BookingType type, int expected)
        => BookingPricing.ForType(type).Should().Be(expected);

    // ── Paiement (virement Interac) — EPIC 7.3 ──────────────────────────────────

    [Fact]
    public void AttachPaymentReference_OnPendingPayment_SetsPendingPaymentInfo()
    {
        var booking = MakeBooking();

        booking.AttachPaymentReference("REF-BOOK-001");

        booking.Payment.Should().NotBeNull();
        booking.Payment!.Reference.Should().Be("REF-BOOK-001");
        booking.Payment.ConfirmedAt.Should().BeNull();
        booking.Status.Should().Be(BookingStatus.PendingPayment);   // toujours en attente
    }

    [Fact]
    public void Activate_ConfirmsPaymentAndConfirmsBooking()
    {
        var booking = MakeBooking();
        booking.AttachPaymentReference("REF-BOOK-001");
        var now = new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc);

        booking.Activate(now);

        booking.Status.Should().Be(BookingStatus.Confirmed);
        booking.Payment!.ConfirmedAt.Should().Be(now);
        booking.Payment.Reference.Should().Be("REF-BOOK-001");      // référence conservée
    }

    [Fact]
    public void Activate_WhenNoPaymentAttached_Throws()
    {
        var booking = MakeBooking();   // aucune référence attachée

        var act = () => booking.Activate(DateTime.UtcNow);

        act.Should().Throw<BusinessRuleException>().WithMessage("*référence de paiement*");
    }

    [Fact]
    public void Activate_WhenAlreadyConfirmed_Throws()
    {
        var booking = MakeBooking();
        booking.AttachPaymentReference("REF-BOOK-001");
        booking.Activate(new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc));

        // 2ᵉ appel sur un paiement déjà confirmé → 422 (idempotence, L-046).
        var act = () => booking.Activate(DateTime.UtcNow);

        act.Should().Throw<BusinessRuleException>().WithMessage("*déjà confirmé*");
    }

    [Fact]
    public void AttachPaymentReference_WhenNotPendingPayment_Throws()
    {
        var booking = MakeBookingIn(BookingStatus.Confirmed);   // déjà confirmée (payée)

        var act = () => booking.AttachPaymentReference("REF-BOOK-002");

        act.Should().Throw<BusinessRuleException>().WithMessage("*en attente de paiement*");
    }

    // ── Machine à états LEGACY (Confirm/Complete/Cancel) ────────────────────────

    [Fact]
    public void Complete_FromConfirmed_SetsCompleted()
    {
        var booking = MakeBookingIn(BookingStatus.Confirmed);

        booking.Complete();

        booking.Status.Should().Be(BookingStatus.Completed);
    }

    [Fact]
    public void Cancel_FromConfirmed_SetsCancelled()
    {
        var booking = MakeBookingIn(BookingStatus.Confirmed);

        booking.Cancel();

        booking.Status.Should().Be(BookingStatus.Cancelled);
    }

    [Fact]
    public void Cancel_FromPendingPayment_SetsCancelled()
    {
        var booking = MakeBooking();   // jamais payée

        booking.Cancel();

        booking.Status.Should().Be(BookingStatus.Cancelled);
    }

    [Theory] // Confirm n'est légal que depuis Pending (statut legacy non produit par Create).
    [InlineData(BookingStatus.Confirmed)]
    [InlineData(BookingStatus.Completed)]
    [InlineData(BookingStatus.Cancelled)]
    public void Confirm_FromNonPending_Throws(BookingStatus from)
    {
        var booking = MakeBookingIn(from);

        var act = booking.Confirm;

        act.Should().Throw<BusinessRuleException>().WithMessage("*en attente*");
        booking.Status.Should().Be(from); // statut inchangé
    }

    [Fact] // Confirm depuis PendingPayment échoue aussi (la voie est Activate, pas Confirm).
    public void Confirm_FromPendingPayment_Throws()
    {
        var booking = MakeBooking();

        var act = booking.Confirm;

        act.Should().Throw<BusinessRuleException>();
        booking.Status.Should().Be(BookingStatus.PendingPayment);
    }

    [Theory] // Complete n'est légal que depuis Confirmed.
    [InlineData(BookingStatus.Completed)]
    [InlineData(BookingStatus.Cancelled)]
    public void Complete_FromNonConfirmed_Throws(BookingStatus from)
    {
        var booking = MakeBookingIn(from);

        var act = booking.Complete;

        act.Should().Throw<BusinessRuleException>().WithMessage("*confirmé*");
        booking.Status.Should().Be(from);
    }

    [Theory] // Cancel est illégal depuis Completed et depuis Cancelled (déjà annulé).
    [InlineData(BookingStatus.Completed)]
    [InlineData(BookingStatus.Cancelled)]
    public void Cancel_FromTerminalState_Throws(BookingStatus from)
    {
        var booking = MakeBookingIn(from);

        var act = booking.Cancel;

        act.Should().Throw<BusinessRuleException>();
        booking.Status.Should().Be(from);
    }

    // ── Report ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Reschedule_ToFutureSlot_UpdatesStartAndKeepsStatus()
    {
        var booking = MakeBooking();
        var now = DateTime.UtcNow;
        var newStart = now.AddDays(40);

        booking.Reschedule(newStart, now);

        booking.SlotStart.Should().Be(newStart);
        booking.Status.Should().Be(BookingStatus.PendingPayment); // statut inchangé
    }

    [Fact]
    public void Reschedule_ConfirmedBooking_StaysConfirmed()
    {
        var booking = MakeBookingIn(BookingStatus.Confirmed);
        var now = DateTime.UtcNow;

        booking.Reschedule(now.AddDays(40), now);

        booking.Status.Should().Be(BookingStatus.Confirmed);
    }

    [Fact]
    public void Reschedule_ToPastSlot_Throws()
    {
        var booking = MakeBooking();
        var now = DateTime.UtcNow;

        var act = () => booking.Reschedule(now.AddDays(-1), now);

        act.Should().Throw<BusinessRuleException>().WithMessage("*futur*");
    }

    [Fact]
    public void Reschedule_CancelledBooking_Throws()
    {
        var booking = MakeBooking();
        booking.Cancel();
        var now = DateTime.UtcNow;

        var act = () => booking.Reschedule(now.AddDays(40), now);

        act.Should().Throw<BusinessRuleException>().WithMessage("*reportée*");
    }
}
