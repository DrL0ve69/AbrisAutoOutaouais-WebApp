using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Planning.Commands.UpsertWorkHours;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Planning;

/// <summary>
/// Upsert des heures par (employé, date) — US-11.2 : crée si absent, met à jour si présent, peut
/// effacer (null), et rejette un employé qui n'est PAS du personnel (Staff). L'employé est validé
/// via <see cref="IIdentityService.GetStaffMembersAsync"/> (frontière — aucun accès AppUser).
/// </summary>
public sealed class UpsertWorkHoursCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();

    private static readonly Guid Staff = Guid.NewGuid();
    private static readonly DateOnly Day = new(2026, 7, 15);

    public UpsertWorkHoursCommandHandlerTests()
        => _identity.GetStaffMembersAsync(Arg.Any<CancellationToken>())
            .Returns(new[] { new StaffMemberDto(Staff, "Sam Staff") } as IReadOnlyList<StaffMemberDto>);

    private UpsertWorkHoursCommandHandler CreateHandler() => new(_db, _identity);

    [Fact]
    public async Task Handle_NoExistingRow_CreatesEntry()
    {
        var id = await CreateHandler().HandleAsync(
            new UpsertWorkHoursCommand(Staff, Day, 8 * 60, 17 * 60, "matin"),
            TestContext.Current.CancellationToken);

        var saved = await _db.WorkHoursEntries.FindAsync([id], TestContext.Current.CancellationToken);
        saved.Should().NotBeNull();
        saved!.EmployeeId.Should().Be(Staff);
        saved.WorkDate.Should().Be(Day);
        saved.StartMinutes.Should().Be(480);
        saved.EndMinutes.Should().Be(1020);
        saved.Note.Should().Be("matin");
    }

    [Fact]
    public async Task Handle_ExistingRow_UpdatesInPlace_SameId()
    {
        var firstId = await CreateHandler().HandleAsync(
            new UpsertWorkHoursCommand(Staff, Day, 8 * 60, 17 * 60, "v1"),
            TestContext.Current.CancellationToken);

        var secondId = await CreateHandler().HandleAsync(
            new UpsertWorkHoursCommand(Staff, Day, 9 * 60, 18 * 60, "v2"),
            TestContext.Current.CancellationToken);

        secondId.Should().Be(firstId); // upsert : même ligne
        _db.WorkHoursEntries.Count(w => w.EmployeeId == Staff && w.WorkDate == Day).Should().Be(1);
        var saved = await _db.WorkHoursEntries.FindAsync([firstId], TestContext.Current.CancellationToken);
        saved!.StartMinutes.Should().Be(540);
        saved.EndMinutes.Should().Be(1080);
        saved.Note.Should().Be("v2");
    }

    [Fact]
    public async Task Handle_ClearHours_SetsNull()
    {
        var id = await CreateHandler().HandleAsync(
            new UpsertWorkHoursCommand(Staff, Day, 8 * 60, 17 * 60, "matin"),
            TestContext.Current.CancellationToken);

        await CreateHandler().HandleAsync(
            new UpsertWorkHoursCommand(Staff, Day, null, null, null),
            TestContext.Current.CancellationToken);

        var saved = await _db.WorkHoursEntries.FindAsync([id], TestContext.Current.CancellationToken);
        saved!.StartMinutes.Should().BeNull();
        saved.EndMinutes.Should().BeNull();
        saved.Note.Should().BeNull();
    }

    [Fact]
    public async Task Handle_EmployeeNotStaff_ThrowsNotFound()
    {
        var act = () => CreateHandler().HandleAsync(
            new UpsertWorkHoursCommand(Guid.NewGuid(), Day, 8 * 60, 17 * 60, null),
            TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<NotFoundException>();
        _db.WorkHoursEntries.Count().Should().Be(0);
    }

    public void Dispose() => _db.Dispose();
}
