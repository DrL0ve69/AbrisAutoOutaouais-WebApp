using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Common;
using AbrisAutoOutaouais_WebApp.Application.Planning.Commands.OptimizeRoute;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Domain.Entities;
using Domain.ValueObjects;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Planning;

/// <summary>
/// Optimisation de tournée (US-11.3). Le handler charge les RDV recalables (Pending/Confirmed) du
/// jour, EXCLUT ceux sans coordonnées (pas de backfill), ordonne par plus proche voisin depuis la
/// base et RÉÉCRIT les heures sur la grille 2 h ; le surplus garde son heure (Rescheduled=false).
/// </summary>
public sealed class OptimizeRouteCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();
    private readonly IDateTimeProvider _clock = Substitute.For<IDateTimeProvider>();

    private static readonly Guid Customer = Guid.NewGuid();

    // Une journée FUTURE (jour ouvré) : les créneaux de grille doivent être dans le futur pour
    // satisfaire BookingSlot.Reschedule (clock < newSlotStart).
    private static readonly DateOnly Day = NextWeekday(DateTime.UtcNow.Date.AddDays(30));

    private static DateOnly NextWeekday(DateTime d)
    {
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            d = d.AddDays(1);
        return DateOnly.FromDateTime(d);
    }

    public OptimizeRouteCommandHandlerTests()
    {
        // Horloge fixe AVANT la journée optimisée → tous les créneaux de grille sont futurs.
        _clock.UtcNow.Returns(DateTime.UtcNow);
        StubProfile(Customer, "Camille", "Client");
    }

    private OptimizeRouteCommandHandler CreateHandler() => new(_db, _identity, _clock);

    private static Address Addr(string city = "Gatineau") =>
        Address.Create("123", "rue des Érables", null, city, "QC", "J8X1A1");

    private void StubProfile(Guid customerId, string first, string last)
        => _identity.GetProfileAsync(customerId, Arg.Any<CancellationToken>())
            .Returns(new UserProfileDto(
                customerId, "x@test.com", "user", first, last, null, null, "fr", null,
                DateTime.UtcNow, new[] { "Customer" }));

    /// <summary>Crée un RDV du jour ciblé à <paramref name="hourUtc"/>, avec coordonnées optionnelles.</summary>
    private async Task<Guid> SeedBookingAsync(
        int hourUtc, BookingStatus status, double? lat, double? lng, string city = "Gatineau")
    {
        var booking = BookingSlot.Create(
            Customer, DateTime.UtcNow.AddDays(60), 120, BookingType.Installation, Addr(city),
            lat: lat, lng: lng);

        // Place le créneau au jour/heure voulus (contourne l'invariant « futur » de Create via reflection,
        // même idiome que GetDayDetailQueryHandlerTests).
        var slotStart = Day.ToDateTime(new TimeOnly(hourUtc, 0), DateTimeKind.Utc);
        typeof(BookingSlot).GetProperty(nameof(BookingSlot.SlotStart))!.SetValue(booking, slotStart);

        if (status == BookingStatus.Confirmed) booking.Confirm();

        _db.BookingSlots.Add(booking);
        await _db.SaveChangesAsync();
        return booking.Id;
    }

    [Fact]
    public async Task Handle_ReschedulesPendingAndConfirmed_OntoGridSlots()
    {
        // Deux RDV géolocalisés, l'un Pending l'autre Confirmed, posés à des heures « en désordre ».
        var pendingId = await SeedBookingAsync(13, BookingStatus.Pending, 45.49, -75.71); // proche base
        var confirmedId = await SeedBookingAsync(9, BookingStatus.Confirmed, 46.0, -74.5); // loin base

        var result = await CreateHandler().HandleAsync(
            new OptimizeRouteCommand(Day), TestContext.Current.CancellationToken);

        result.Stops.Should().HaveCount(2);
        result.ExcludedBookingIds.Should().BeEmpty();
        // Les deux sont recalés et l'ordre suit la proximité (proche d'abord).
        result.Stops.Should().OnlyContain(s => s.Rescheduled);
        result.Stops[0].BookingId.Should().Be(pendingId);
        result.Stops[1].BookingId.Should().Be(confirmedId);

        // Heures réécrites sur la grille : 1er créneau 08:00 UTC, 2e 10:00 UTC.
        var grid0 = Day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);
        var grid1 = Day.ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc);
        result.Stops[0].SlotStart.Should().Be(grid0);
        result.Stops[1].SlotStart.Should().Be(grid1);

        // Persisté en base.
        var persisted = await _db.BookingSlots.FindAsync(
            [pendingId], TestContext.Current.CancellationToken);
        persisted!.SlotStart.Should().Be(grid0);
    }

    [Fact]
    public async Task Handle_ExcludesBookingsWithoutCoordinates()
    {
        var locatedId = await SeedBookingAsync(13, BookingStatus.Pending, 45.49, -75.71);
        var noCoordsId = await SeedBookingAsync(9, BookingStatus.Pending, null, null);

        var result = await CreateHandler().HandleAsync(
            new OptimizeRouteCommand(Day), TestContext.Current.CancellationToken);

        result.Stops.Should().ContainSingle();
        result.Stops[0].BookingId.Should().Be(locatedId);
        result.ExcludedBookingIds.Should().ContainSingle().Which.Should().Be(noCoordsId);

        // Le RDV exclu garde son heure d'origine (9:00 UTC) — non recalé.
        var excluded = await _db.BookingSlots.FindAsync(
            [noCoordsId], TestContext.Current.CancellationToken);
        excluded!.SlotStart.Should().Be(Day.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc));
    }

    [Fact]
    public async Task Handle_IgnoresCompletedAndCancelledBookings()
    {
        // Completed/Cancelled ne sont pas recalables ; ils ne doivent pas figurer dans le résultat.
        var cancelled = BookingSlot.Create(
            Customer, DateTime.UtcNow.AddDays(60), 120, BookingType.Installation, Addr(),
            lat: 45.5, lng: -75.6);
        cancelled.Cancel();
        typeof(BookingSlot).GetProperty(nameof(BookingSlot.SlotStart))!
            .SetValue(cancelled, Day.ToDateTime(new TimeOnly(11, 0), DateTimeKind.Utc));
        _db.BookingSlots.Add(cancelled);
        await _db.SaveChangesAsync();

        var pendingId = await SeedBookingAsync(13, BookingStatus.Pending, 45.49, -75.71);

        var result = await CreateHandler().HandleAsync(
            new OptimizeRouteCommand(Day), TestContext.Current.CancellationToken);

        result.Stops.Should().ContainSingle().Which.BookingId.Should().Be(pendingId);
        result.ExcludedBookingIds.Should().NotContain(cancelled.Id);
    }

    [Fact]
    public async Task Handle_SurplusBeyondGridSlots_KeepsOriginalTime_NotRescheduled()
    {
        // La grille 08–17 h en blocs de 2 h offre 4 créneaux (08,10,12,14). On seede 5 RDV
        // géolocalisés → le 5e est un surplus : non recalé, garde son heure d'origine.
        var ids = new List<Guid>();
        for (var i = 0; i < 5; i++)
        {
            // Heures d'origine distinctes (toutes hors grille standard pour bien voir le recalage),
            // coordonnées légèrement différentes pour un ordre déterministe.
            var id = await SeedBookingAsync(
                hourUtc: 7, BookingStatus.Pending, lat: 45.49 + i * 0.01, lng: -75.71 - i * 0.01);
            ids.Add(id);
        }

        var result = await CreateHandler().HandleAsync(
            new OptimizeRouteCommand(Day), TestContext.Current.CancellationToken);

        result.Stops.Should().HaveCount(5);
        result.Stops.Count(s => s.Rescheduled).Should().Be(4); // 4 créneaux de grille
        var surplus = result.Stops.Single(s => !s.Rescheduled);
        surplus.Order.Should().Be(4); // le dernier visité = surplus
        // Surplus : heure d'origine (07:00 UTC) conservée — aucun créneau invalide créé.
        surplus.SlotStart.Should().Be(Day.ToDateTime(new TimeOnly(7, 0), DateTimeKind.Utc));
    }

    [Fact]
    public async Task Handle_GridSlotOccupiedByExcludedBooking_ReschedulesOntoFreeSlot_NoCollision()
    {
        // Un RDV EXCLU (sans coords) garde son heure d'origine 08:00 — exactement le 1er créneau de
        // grille. Le RDV localisable ne doit donc PAS être recalé sur 08:00 (double-réservation que
        // RescheduleBooking interdit), mais sur le prochain créneau LIBRE (10:00). Finding 1, L-009 :
        // l'assertion échoue si le handler écrase l'heure gelée.
        var excludedId = await SeedBookingAsync(8, BookingStatus.Pending, lat: null, lng: null);
        var locatableId = await SeedBookingAsync(13, BookingStatus.Pending, 45.49, -75.71);

        var result = await CreateHandler().HandleAsync(
            new OptimizeRouteCommand(Day), TestContext.Current.CancellationToken);

        result.ExcludedBookingIds.Should().ContainSingle().Which.Should().Be(excludedId);
        result.Stops.Should().ContainSingle().Which.BookingId.Should().Be(locatableId);

        var grid0 = Day.ToDateTime(new TimeOnly(8, 0), DateTimeKind.Utc);  // occupé par l'exclu
        var grid1 = Day.ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc); // 1er créneau libre

        // Le localisable est recalé sur 10:00 (libre), pas sur 08:00 (gelé par l'exclu).
        result.Stops[0].Rescheduled.Should().BeTrue();
        result.Stops[0].SlotStart.Should().Be(grid1);
        result.Stops[0].SlotStart.Should().NotBe(grid0);

        // L'exclu garde son heure d'origine (08:00) — non recalé.
        var excluded = await _db.BookingSlots.FindAsync(
            [excludedId], TestContext.Current.CancellationToken);
        excluded!.SlotStart.Should().Be(grid0);

        // Invariant dur : jamais deux RDV du jour à la même heure de début.
        var allStarts = await _db.BookingSlots
            .Where(b => b.SlotStart >= Day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
                && b.SlotStart < Day.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc))
            .Select(b => b.SlotStart)
            .ToListAsync(TestContext.Current.CancellationToken);
        allStarts.Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task Handle_GridSlotCount_MatchesSlotRules()
    {
        // Verrou : le nombre de créneaux recalables doit suivre SlotRules (08–17 h, 2 h) = 4.
        var expectedSlots = 0;
        for (var t = SlotRules.WorkStart; t + SlotRules.SlotDuration <= SlotRules.WorkEnd;
             t += SlotRules.SlotDuration)
            expectedSlots++;

        expectedSlots.Should().Be(4);
    }

    public void Dispose() => _db.Dispose();
}
