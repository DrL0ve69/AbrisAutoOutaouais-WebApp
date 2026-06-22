using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.MarkPeriodPaid;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;
using System.Linq;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Payroll;

/// <summary>
/// Marquage du statut de paie sur une fenêtre (EPIC 8) : applique la garde de transition du domaine
/// (<c>MarkPaid</c>/<c>MarkUnpaid</c>) à chaque ligne, n'agit que dans la fenêtre, rejette un employé
/// non-Staff (404), et retourne le nombre de lignes touchées.
/// </summary>
public sealed class MarkPeriodPaidCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();

    private static readonly Guid Staff = Guid.NewGuid();
    private static readonly DateOnly From = new(2026, 7, 1);
    private static readonly DateOnly To = new(2026, 7, 31);

    public MarkPeriodPaidCommandHandlerTests()
        => _identity.GetStaffWithRatesAsync(Arg.Any<CancellationToken>())
            .Returns(new[] { new StaffPayRateDto(Staff, "Sam Staff", 20m) } as IReadOnlyList<StaffPayRateDto>);

    private MarkPeriodPaidCommandHandler CreateHandler() => new(_db, _identity);

    [Fact]
    public async Task Handle_MarksAllLinesInWindowPaid_ReturnsCount()
    {
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Staff, new(2026, 7, 5), 480, 1020));
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Staff, new(2026, 7, 6), 480, 1020));
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var count = await CreateHandler().HandleAsync(
            new MarkPeriodPaidCommand(Staff, From, To, PayStatus.Payee),
            TestContext.Current.CancellationToken);

        count.Should().Be(2);
        _db.WorkHoursEntries.Where(w => w.EmployeeId == Staff)
            .All(w => w.PayStatus == PayStatus.Payee).Should().BeTrue();
    }

    [Fact]
    public async Task Handle_DoesNotTouchLinesOutsideWindow()
    {
        var inside = WorkHoursEntry.Create(Staff, new(2026, 7, 15), 480, 1020);
        var outside = WorkHoursEntry.Create(Staff, new(2026, 8, 1), 480, 1020);
        _db.WorkHoursEntries.AddRange(inside, outside);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var count = await CreateHandler().HandleAsync(
            new MarkPeriodPaidCommand(Staff, From, To, PayStatus.Payee),
            TestContext.Current.CancellationToken);

        count.Should().Be(1);
        var reloadedOutside = await _db.WorkHoursEntries.FindAsync(
            [outside.Id], TestContext.Current.CancellationToken);
        reloadedOutside!.PayStatus.Should().Be(PayStatus.AnsPayer); // hors fenêtre → intact
    }

    [Fact]
    public async Task Handle_MarkUnpaid_RevertsStatus()
    {
        var entry = WorkHoursEntry.Create(Staff, new(2026, 7, 5), 480, 1020);
        entry.MarkPaid();
        _db.WorkHoursEntries.Add(entry);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateHandler().HandleAsync(
            new MarkPeriodPaidCommand(Staff, From, To, PayStatus.AnsPayer),
            TestContext.Current.CancellationToken);

        var reloaded = await _db.WorkHoursEntries.FindAsync([entry.Id], TestContext.Current.CancellationToken);
        reloaded!.PayStatus.Should().Be(PayStatus.AnsPayer);
    }

    [Fact]
    public async Task Handle_EmployeeNotStaff_ThrowsNotFound()
    {
        var act = () => CreateHandler().HandleAsync(
            new MarkPeriodPaidCommand(Guid.NewGuid(), From, To, PayStatus.Payee),
            TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    public void Dispose() => _db.Dispose();
}
