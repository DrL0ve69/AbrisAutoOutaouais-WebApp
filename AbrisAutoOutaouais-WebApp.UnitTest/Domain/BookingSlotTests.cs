using Domain.Entities;
using Domain.ValueObjects;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Règles de transition de statut d'un créneau (machine à états utilisée par l'admin :
/// Pending → Confirmed|Cancelled ; Confirmed → Completed|Cancelled ; tout le reste échoue)
/// et règles de report : seule une réservation à venir (Pending/Confirmed) est reportable,
/// vers un créneau futur, et le statut est conservé.
/// </summary>
public sealed class BookingSlotTests
{
    private static Address MakeAddress()
        => Address.Create("123 rue des Érables", "Gatineau", "QC", "J8X1A1");

    // Create exige un créneau futur (DateTime.UtcNow réel) → on part loin dans le futur.
    private static BookingSlot MakeBooking()
        => BookingSlot.Create(
            Guid.NewGuid(), DateTime.UtcNow.AddDays(30), 120,
            BookingType.Installation, MakeAddress());

    /// <summary>Amène une réservation neuve (Pending) jusqu'au statut demandé.</summary>
    private static BookingSlot MakeBookingIn(BookingStatus status)
    {
        var booking = MakeBooking();
        switch (status)
        {
            case BookingStatus.Confirmed:
                booking.Confirm();
                break;
            case BookingStatus.Completed:
                booking.Confirm();
                booking.Complete();
                break;
            case BookingStatus.Cancelled:
                booking.Cancel();
                break;
        }
        return booking;
    }

    // ── Matrice des transitions de statut ────────────────────────────────────

    [Fact]
    public void Confirm_FromPending_SetsConfirmed()
    {
        var booking = MakeBookingIn(BookingStatus.Pending);

        booking.Confirm();

        booking.Status.Should().Be(BookingStatus.Confirmed);
    }

    [Fact]
    public void Cancel_FromPending_SetsCancelled()
    {
        var booking = MakeBookingIn(BookingStatus.Pending);

        booking.Cancel();

        booking.Status.Should().Be(BookingStatus.Cancelled);
    }

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

    [Theory] // Confirm n'est légal que depuis Pending.
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

    [Theory] // Complete n'est légal que depuis Confirmed.
    [InlineData(BookingStatus.Pending)]
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

    [Fact]
    public void Reschedule_ToFutureSlot_UpdatesStartAndKeepsStatus()
    {
        var booking = MakeBooking();
        var now = DateTime.UtcNow;
        var newStart = now.AddDays(40);

        booking.Reschedule(newStart, now);

        booking.SlotStart.Should().Be(newStart);
        booking.Status.Should().Be(BookingStatus.Pending); // statut inchangé
    }

    [Fact]
    public void Reschedule_ConfirmedBooking_StaysConfirmed()
    {
        var booking = MakeBooking();
        booking.Confirm();
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
