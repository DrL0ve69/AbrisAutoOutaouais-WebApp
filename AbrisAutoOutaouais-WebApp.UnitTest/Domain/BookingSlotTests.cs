using Domain.Entities;
using Domain.ValueObjects;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Règles de report d'un créneau : seule une réservation à venir (Pending/Confirmed) est
/// reportable, vers un créneau futur, et le statut est conservé.
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
