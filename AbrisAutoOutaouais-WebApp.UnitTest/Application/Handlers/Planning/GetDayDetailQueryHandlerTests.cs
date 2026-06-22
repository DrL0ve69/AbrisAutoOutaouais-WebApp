using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Planning.Queries.GetDayDetail;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Domain.Entities;
using Domain.ValueObjects;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Planning;

/// <summary>
/// Détail d'une journée (US-11.2) : le handler agrège les RDV du jour (fenêtre par début, L-007),
/// liste TOUS les employés (Staff) — y compris ceux sans heures saisies (HasEntry=false) — et
/// rattache leurs heures à la date. La distinction « pas de ligne » vs « ligne aux heures nulles »
/// est portée par <c>HasEntry</c>.
/// </summary>
public sealed class GetDayDetailQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();

    private static readonly Guid Customer = Guid.NewGuid();
    private static readonly Guid StaffA = Guid.NewGuid();
    private static readonly Guid StaffB = Guid.NewGuid();
    private static readonly DateOnly Day = new(2026, 7, 15);

    private GetDayDetailQueryHandler CreateHandler() => new(_db, _identity);

    private static Address Addr() => Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1");

    private void StubStaff(params StaffMemberDto[] members)
        => _identity.GetStaffMembersAsync(Arg.Any<CancellationToken>())
            .Returns(members.ToList() as IReadOnlyList<StaffMemberDto>);

    private void StubProfile(Guid customerId, string first, string last)
        => _identity.GetProfileAsync(customerId, Arg.Any<CancellationToken>())
            .Returns(new UserProfileDto(
                customerId, "x@test.com", "user", first, last, null, null, "fr", null,
                DateTime.UtcNow, new[] { "Customer" }));

    private async Task SeedBookingAsync(DateTime slotStartUtc)
    {
        var booking = BookingSlot.Create(
            Customer, DateTime.UtcNow.AddDays(60), 120, BookingType.Installation, Addr());
        typeof(BookingSlot).GetProperty(nameof(BookingSlot.SlotStart))!.SetValue(booking, slotStartUtc);
        _db.BookingSlots.Add(booking);
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task Handle_ReturnsAllStaff_WithAndWithoutHours()
    {
        StubStaff(new StaffMemberDto(StaffA, "Alice Anderson"), new StaffMemberDto(StaffB, "Bob Brown"));
        // StaffA a une ligne d'heures ce jour ; StaffB n'en a pas.
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(StaffA, Day, 8 * 60, 17 * 60, "matin"));
        await _db.SaveChangesAsync();

        var result = await CreateHandler().HandleAsync(
            new GetDayDetailQuery(Day), TestContext.Current.CancellationToken);

        result.Date.Should().Be(Day);
        result.Staff.Should().HaveCount(2);

        var a = result.Staff.Single(s => s.EmployeeId == StaffA);
        a.HasEntry.Should().BeTrue();
        a.StartMinutes.Should().Be(480);
        a.EndMinutes.Should().Be(1020);
        a.Note.Should().Be("matin");

        var b = result.Staff.Single(s => s.EmployeeId == StaffB);
        b.HasEntry.Should().BeFalse();
        b.StartMinutes.Should().BeNull();
        b.EndMinutes.Should().BeNull();
    }

    [Fact]
    public async Task Handle_IncludesBookingsStartingThatDay_ProjectsNameAndCity()
    {
        StubStaff();
        StubProfile(Customer, "Camille", "Client");
        await SeedBookingAsync(new DateTime(2026, 7, 15, 14, 0, 0, DateTimeKind.Utc));

        var result = await CreateHandler().HandleAsync(
            new GetDayDetailQuery(Day), TestContext.Current.CancellationToken);

        result.Bookings.Should().ContainSingle();
        result.Bookings[0].CustomerName.Should().Be("Camille Client");
        result.Bookings[0].City.Should().Be("Gatineau");
    }

    [Fact]
    public async Task Handle_ExcludesBookingsAndHoursFromOtherDays()
    {
        StubStaff(new StaffMemberDto(StaffA, "Alice Anderson"));
        StubProfile(Customer, "Camille", "Client");
        await SeedBookingAsync(new DateTime(2026, 7, 16, 14, 0, 0, DateTimeKind.Utc)); // lendemain
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(StaffA, new DateOnly(2026, 7, 16), 480, 1020));
        await _db.SaveChangesAsync();

        var result = await CreateHandler().HandleAsync(
            new GetDayDetailQuery(Day), TestContext.Current.CancellationToken);

        result.Bookings.Should().BeEmpty();
        // L'employé est toujours listé, mais SANS heures pour CE jour-là.
        result.Staff.Should().ContainSingle();
        result.Staff[0].HasEntry.Should().BeFalse();
    }

    public void Dispose() => _db.Dispose();
}
