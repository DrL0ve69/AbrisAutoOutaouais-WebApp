using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Payroll.Queries.GetPayrollSummary;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;
using System.Linq;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Payroll;

/// <summary>
/// Récap de paie INFORMATIF (EPIC 8, US-8.1) : agrège les heures par employé sur une fenêtre, calcule
/// le montant brut (minutes/60 × taux), distingue « taux non défini » (montant null, jamais 0), et
/// dérive le statut agrégé (Payée SSI toutes les lignes sont payées).
/// </summary>
public sealed class GetPayrollSummaryQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();

    private static readonly Guid Alice = Guid.NewGuid();
    private static readonly Guid Bob = Guid.NewGuid();
    private static readonly DateOnly From = new(2026, 7, 1);
    private static readonly DateOnly To = new(2026, 7, 31);

    private void SeedStaff(params StaffPayRateDto[] staff)
        => _identity.GetStaffWithRatesAsync(Arg.Any<CancellationToken>())
            .Returns(staff as IReadOnlyList<StaffPayRateDto>);

    private GetPayrollSummaryQueryHandler CreateHandler() => new(_db, _identity);

    [Fact]
    public async Task Handle_ComputesAmountFromMinutesAndRate()
    {
        SeedStaff(new StaffPayRateDto(Alice, "Alice", 20m));
        // 8h00 → 17h00 = 540 min ; et une 2e journée 9h00 → 12h00 = 180 min ; total 720 min = 12 h.
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 7, 5), 480, 1020));
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 7, 6), 540, 720));
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateHandler().HandleAsync(
            new GetPayrollSummaryQuery(From, To), TestContext.Current.CancellationToken);

        var alice = result.Employees.Single(e => e.EmployeeId == Alice);
        alice.TotalMinutes.Should().Be(720);
        alice.Amount.Should().Be(240m); // 12 h × 20 $
        alice.EntryCount.Should().Be(2);
        result.TotalPayroll.Should().Be(240m);
    }

    [Fact]
    public async Task Handle_RateNull_AmountIsNull_NotZero_AndExcludedFromTotal()
    {
        SeedStaff(new StaffPayRateDto(Alice, "Alice", null));
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 7, 5), 480, 1020));
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateHandler().HandleAsync(
            new GetPayrollSummaryQuery(From, To), TestContext.Current.CancellationToken);

        var alice = result.Employees.Single(e => e.EmployeeId == Alice);
        alice.TotalMinutes.Should().Be(540);
        alice.Amount.Should().BeNull(); // taux non défini → null, JAMAIS 0
        result.TotalPayroll.Should().Be(0m); // exclu du total
    }

    [Fact]
    public async Task Handle_OnlyCountsMinutesWhenBothBoundsPresent()
    {
        SeedStaff(new StaffPayRateDto(Alice, "Alice", 10m));
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 7, 5), 480, 1020)); // 540 min
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 7, 6), null, null)); // présent, non précisé
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateHandler().HandleAsync(
            new GetPayrollSummaryQuery(From, To), TestContext.Current.CancellationToken);

        var alice = result.Employees.Single(e => e.EmployeeId == Alice);
        alice.TotalMinutes.Should().Be(540); // la journée sans bornes ne compte pas
        alice.EntryCount.Should().Be(2);
    }

    [Fact]
    public async Task Handle_StatusPayee_OnlyWhenAllLinesPaid()
    {
        SeedStaff(new StaffPayRateDto(Alice, "Alice", 10m));
        var paid = WorkHoursEntry.Create(Alice, new(2026, 7, 5), 480, 1020);
        paid.MarkPaid();
        var unpaid = WorkHoursEntry.Create(Alice, new(2026, 7, 6), 480, 1020);
        _db.WorkHoursEntries.AddRange(paid, unpaid);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateHandler().HandleAsync(
            new GetPayrollSummaryQuery(From, To), TestContext.Current.CancellationToken);

        var alice = result.Employees.Single(e => e.EmployeeId == Alice);
        alice.PayStatus.Should().Be(PayStatus.AnsPayer); // une ligne non payée → pas globalement payé
        alice.UnpaidCount.Should().Be(1);
    }

    [Fact]
    public async Task Handle_AllLinesPaid_StatusPayee()
    {
        SeedStaff(new StaffPayRateDto(Alice, "Alice", 10m));
        var l1 = WorkHoursEntry.Create(Alice, new(2026, 7, 5), 480, 1020);
        l1.MarkPaid();
        var l2 = WorkHoursEntry.Create(Alice, new(2026, 7, 6), 480, 1020);
        l2.MarkPaid();
        _db.WorkHoursEntries.AddRange(l1, l2);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateHandler().HandleAsync(
            new GetPayrollSummaryQuery(From, To), TestContext.Current.CancellationToken);

        var alice = result.Employees.Single(e => e.EmployeeId == Alice);
        alice.PayStatus.Should().Be(PayStatus.Payee);
        alice.UnpaidCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_EmployeeWithNoEntries_AppearsWithZeroAndAnsPayer()
    {
        SeedStaff(new StaffPayRateDto(Bob, "Bob", 15m));

        var result = await CreateHandler().HandleAsync(
            new GetPayrollSummaryQuery(From, To), TestContext.Current.CancellationToken);

        var bob = result.Employees.Single(e => e.EmployeeId == Bob);
        bob.TotalMinutes.Should().Be(0);
        bob.EntryCount.Should().Be(0);
        bob.Amount.Should().Be(0m); // taux défini, 0 minute → 0 $
        bob.PayStatus.Should().Be(PayStatus.AnsPayer); // aucune ligne → pas « payé »
    }

    [Fact]
    public async Task Handle_ExcludesEntriesOutsideWindow()
    {
        SeedStaff(new StaffPayRateDto(Alice, "Alice", 10m));
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 6, 30), 480, 1020)); // avant
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 8, 1), 480, 1020));  // après
        _db.WorkHoursEntries.Add(WorkHoursEntry.Create(Alice, new(2026, 7, 15), 480, 1020)); // dans
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateHandler().HandleAsync(
            new GetPayrollSummaryQuery(From, To), TestContext.Current.CancellationToken);

        result.Employees.Single(e => e.EmployeeId == Alice).EntryCount.Should().Be(1);
    }

    public void Dispose() => _db.Dispose();
}
