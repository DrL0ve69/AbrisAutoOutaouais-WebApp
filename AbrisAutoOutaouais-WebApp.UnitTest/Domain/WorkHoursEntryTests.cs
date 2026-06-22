using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Invariants de <see cref="WorkHoursEntry"/> (US-11.2) : bornes horaires en minutes locales depuis
/// minuit, fin strictement après début quand les deux sont présentes, nulls valides (« présent,
/// horaire non précisé »).
/// </summary>
public sealed class WorkHoursEntryTests
{
    private static readonly Guid Employee = Guid.NewGuid();
    private static readonly DateOnly Day = new(2026, 7, 15);

    [Fact]
    public void Create_WithValidHours_SetsFields()
    {
        var entry = WorkHoursEntry.Create(Employee, Day, 8 * 60, 17 * 60, "  Quart du matin  ");

        entry.EmployeeId.Should().Be(Employee);
        entry.WorkDate.Should().Be(Day);
        entry.StartMinutes.Should().Be(480);
        entry.EndMinutes.Should().Be(1020);
        entry.Note.Should().Be("Quart du matin"); // trim
    }

    [Fact]
    public void Create_WithBothNull_IsValid_PresentButUnspecified()
    {
        var entry = WorkHoursEntry.Create(Employee, Day, null, null);

        entry.StartMinutes.Should().BeNull();
        entry.EndMinutes.Should().BeNull();
        entry.Note.Should().BeNull();
    }

    [Fact]
    public void Create_BlankNote_NormalizedToNull()
    {
        var entry = WorkHoursEntry.Create(Employee, Day, null, null, "   ");

        entry.Note.Should().BeNull();
    }

    [Fact]
    public void Create_EmptyEmployee_Throws()
    {
        var act = () => WorkHoursEntry.Create(Guid.Empty, Day, 480, 1020);

        act.Should().Throw<BusinessRuleException>().WithMessage("*employé*");
    }

    [Fact]
    public void Create_EndBeforeOrEqualStart_Throws()
    {
        var act = () => WorkHoursEntry.Create(Employee, Day, 600, 600);

        act.Should().Throw<BusinessRuleException>().WithMessage("*postérieure*");
    }

    [Theory]
    [InlineData(-1, 600)]
    [InlineData(600, 24 * 60)]
    [InlineData(24 * 60, null)]
    public void Create_OutOfRangeMinutes_Throws(int? start, int? end)
    {
        var act = () => WorkHoursEntry.Create(Employee, Day, start, end);

        act.Should().Throw<BusinessRuleException>();
    }

    [Fact]
    public void UpdateHours_ReplacesHoursAndNote()
    {
        var entry = WorkHoursEntry.Create(Employee, Day, 8 * 60, 17 * 60, "initiale");

        entry.UpdateHours(9 * 60, 18 * 60, "ajustée");

        entry.StartMinutes.Should().Be(540);
        entry.EndMinutes.Should().Be(1080);
        entry.Note.Should().Be("ajustée");
    }

    [Fact]
    public void UpdateHours_ToNull_ClearsHours()
    {
        var entry = WorkHoursEntry.Create(Employee, Day, 8 * 60, 17 * 60);

        entry.UpdateHours(null, null, null);

        entry.StartMinutes.Should().BeNull();
        entry.EndMinutes.Should().BeNull();
        entry.Note.Should().BeNull();
    }

    [Fact]
    public void UpdateHours_EndBeforeStart_Throws()
    {
        var entry = WorkHoursEntry.Create(Employee, Day, 8 * 60, 17 * 60);

        var act = () => entry.UpdateHours(1020, 480, null);

        act.Should().Throw<BusinessRuleException>().WithMessage("*postérieure*");
    }
}
