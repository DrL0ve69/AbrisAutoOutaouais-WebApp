using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;
using FluentValidation.TestHelper;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>
/// Garde-fous de la fenêtre du calendrier (US-11.1) : To ≥ From, plage bornée à 92 jours.
/// </summary>
public sealed class GetCalendarBookingsQueryValidatorTests
{
    private readonly GetCalendarBookingsQueryValidator _validator = new();

    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    [Fact]
    public void Validate_ToBeforeFrom_HasError()
    {
        var query = new GetCalendarBookingsQuery(D(2026, 7, 10), D(2026, 7, 6));

        _validator.TestValidate(query)
            .ShouldHaveValidationErrorFor(x => x.To);
    }

    [Fact]
    public void Validate_RangeTooLarge_HasError()
    {
        // 93 jours d'écart (> 92) → rejeté.
        var from = D(2026, 1, 1);
        var to = from.AddDays(GetCalendarBookingsQueryValidator.MaxRangeDays + 1);

        var result = _validator.Validate(new GetCalendarBookingsQuery(from, to));
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("plage de dates"));
    }

    [Fact]
    public void Validate_SameDay_IsValid()
    {
        var query = new GetCalendarBookingsQuery(D(2026, 7, 6), D(2026, 7, 6));

        _validator.TestValidate(query).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_TypicalMonthRange_IsValid()
    {
        var query = new GetCalendarBookingsQuery(D(2026, 7, 1), D(2026, 7, 31));

        _validator.TestValidate(query).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_RangeAtMaxBound_IsValid()
    {
        var from = D(2026, 1, 1);
        var to = from.AddDays(GetCalendarBookingsQueryValidator.MaxRangeDays); // exactement 92 jours

        _validator.TestValidate(new GetCalendarBookingsQuery(from, to))
            .ShouldNotHaveAnyValidationErrors();
    }
}
