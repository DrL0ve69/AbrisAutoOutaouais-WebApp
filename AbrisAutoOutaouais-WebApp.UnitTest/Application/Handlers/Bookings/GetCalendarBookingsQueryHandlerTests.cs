using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Domain.Entities;
using Domain.ValueObjects;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Bookings;

/// <summary>
/// Vue planning (US-11.1) : le handler agrège les BookingSlot par fenêtre de dates UNIQUEMENT
/// (Admin et Staff voient tout — pas de filtre par utilisateur), exclut le hors-plage et le
/// soft-delete, projette nom client (via IIdentityService) et ville, et — chevauchement de bord
/// (L-007) — N'INCLUT PAS un créneau dont le DÉBUT précède la fenêtre, ce qui est correct tant
/// qu'un créneau reste sous-journalier (SlotRules.SlotDuration = 2 h).
/// </summary>
public sealed class GetCalendarBookingsQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();

    private GetCalendarBookingsQueryHandler CreateHandler() => new(_db, _identity);

    private static Address Addr(string city = "Gatineau")
        => Address.Create("123", "rue des Érables", null, city, "QC", "J8X1A1");

    /// <summary>Crée un BookingSlot (l'agrégat exige un créneau futur) avec un SlotStart imposé via réflexion.</summary>
    private async Task<Guid> SeedAsync(
        Guid customerId, DateTime slotStartUtc, string city = "Gatineau", bool softDeleted = false)
    {
        // L'agrégat refuse un créneau passé : on crée sur un créneau futur générique puis on
        // force SlotStart à la valeur de test (les fenêtres de test couvrent passé et futur).
        var booking = BookingSlot.Create(
            customerId, DateTime.UtcNow.AddDays(60), 120, BookingType.Installation, Addr(city));
        typeof(BookingSlot).GetProperty(nameof(BookingSlot.SlotStart))!
            .SetValue(booking, slotStartUtc);
        if (softDeleted) booking.IsDeleted = true;

        _db.BookingSlots.Add(booking);
        await _db.SaveChangesAsync();
        return booking.Id;
    }

    private void StubProfile(Guid customerId, string first, string last)
        => _identity.GetProfileAsync(customerId, Arg.Any<CancellationToken>())
            .Returns(new UserProfileDto(
                customerId, "x@test.com", "user", first, last, null, null, "fr", null,
                DateTime.UtcNow, new[] { "Customer" }));

    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    [Fact]
    public async Task Handle_ReturnsBookingsWhoseStartIsWithinWindow_AndProjectsNameAndCity()
    {
        var customer = Guid.NewGuid();
        StubProfile(customer, "Camille", "Client");
        var id = await SeedAsync(customer, new DateTime(2026, 7, 8, 14, 0, 0, DateTimeKind.Utc), "Hull");

        var result = await CreateHandler().HandleAsync(
            new GetCalendarBookingsQuery(D(2026, 7, 6), D(2026, 7, 10)),
            TestContext.Current.CancellationToken);

        result.Should().ContainSingle();
        var dto = result[0];
        dto.Id.Should().Be(id);
        dto.CustomerName.Should().Be("Camille Client");
        dto.City.Should().Be("Hull");
        dto.Type.Should().Be("Installation");
        dto.SlotStart.Should().Be(new DateTime(2026, 7, 8, 14, 0, 0, DateTimeKind.Utc));
        dto.SlotEnd.Should().Be(new DateTime(2026, 7, 8, 16, 0, 0, DateTimeKind.Utc)); // +120 min
    }

    [Fact]
    public async Task Handle_IncludesBookingsOnFirstAndLastDay_BoundsInclusive()
    {
        var customer = Guid.NewGuid();
        StubProfile(customer, "A", "B");
        await SeedAsync(customer, new DateTime(2026, 7, 6, 8, 0, 0, DateTimeKind.Utc));   // premier jour
        await SeedAsync(customer, new DateTime(2026, 7, 10, 15, 0, 0, DateTimeKind.Utc)); // dernier jour, fin de journée

        var result = await CreateHandler().HandleAsync(
            new GetCalendarBookingsQuery(D(2026, 7, 6), D(2026, 7, 10)),
            TestContext.Current.CancellationToken);

        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_ExcludesBookingsOutsideWindow()
    {
        var customer = Guid.NewGuid();
        StubProfile(customer, "A", "B");
        await SeedAsync(customer, new DateTime(2026, 7, 5, 23, 0, 0, DateTimeKind.Utc));   // veille
        await SeedAsync(customer, new DateTime(2026, 7, 11, 8, 0, 0, DateTimeKind.Utc));   // lendemain de To

        var result = await CreateHandler().HandleAsync(
            new GetCalendarBookingsQuery(D(2026, 7, 6), D(2026, 7, 10)),
            TestContext.Current.CancellationToken);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ExcludesSoftDeletedBookings()
    {
        var customer = Guid.NewGuid();
        StubProfile(customer, "A", "B");
        await SeedAsync(customer, new DateTime(2026, 7, 8, 10, 0, 0, DateTimeKind.Utc), softDeleted: true);

        var result = await CreateHandler().HandleAsync(
            new GetCalendarBookingsQuery(D(2026, 7, 6), D(2026, 7, 10)),
            TestContext.Current.CancellationToken);

        // HasQueryFilter(b => !b.IsDeleted) exclut le créneau supprimé.
        result.Should().BeEmpty();
    }

    /// <summary>
    /// L-007 — chevauchement de bord : un créneau dont le DÉBUT est la veille de la fenêtre est
    /// EXCLU (filtre par début). C'est correct UNIQUEMENT parce qu'un créneau est sous-journalier :
    /// il se termine la veille et ne chevauche jamais le premier jour. Ce test épingle l'hypothèse
    /// de durée 2 h (SlotRules.SlotDuration < 24 h) — si la durée devenait multi-jours, le filtre
    /// devrait élargir sa borne basse (voir commentaire du handler).
    /// </summary>
    [Fact]
    public async Task Handle_BookingStartingDayBeforeWindow_IsExcluded_SubDayDurationInvariant()
    {
        var customer = Guid.NewGuid();
        StubProfile(customer, "A", "B");
        // Début 22 h la veille du premier jour : avec 2 h de durée, fin à minuit → aucun
        // chevauchement avec le 6 juillet. Le filtre par début l'exclut, ce qui est correct.
        await SeedAsync(customer, new DateTime(2026, 7, 5, 22, 0, 0, DateTimeKind.Utc));

        var result = await CreateHandler().HandleAsync(
            new GetCalendarBookingsQuery(D(2026, 7, 6), D(2026, 7, 10)),
            TestContext.Current.CancellationToken);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_UnknownCustomerProfile_ProjectsDash()
    {
        var customer = Guid.NewGuid();
        _identity.GetProfileAsync(customer, Arg.Any<CancellationToken>())
            .Returns((UserProfileDto?)null);
        await SeedAsync(customer, new DateTime(2026, 7, 8, 10, 0, 0, DateTimeKind.Utc));

        var result = await CreateHandler().HandleAsync(
            new GetCalendarBookingsQuery(D(2026, 7, 6), D(2026, 7, 10)),
            TestContext.Current.CancellationToken);

        result.Should().ContainSingle();
        result[0].CustomerName.Should().Be("—");
    }

    public void Dispose() => _db.Dispose();
}
