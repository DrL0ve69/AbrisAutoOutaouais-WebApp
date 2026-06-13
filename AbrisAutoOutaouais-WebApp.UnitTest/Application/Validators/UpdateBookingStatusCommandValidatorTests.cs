using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.UpdateBookingStatus;
using FluentValidation.TestHelper;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>
/// Le validateur ne tranche que la FORME (id + action non vides) ; une action non vide
/// mais inconnue relève de la règle métier (422 dans le handler, même idiome que
/// UpdateOrderStatus).
/// </summary>
public sealed class UpdateBookingStatusCommandValidatorTests
{
    private readonly UpdateBookingStatusCommandValidator _validator = new();

    [Theory]
    [InlineData("confirm")]
    [InlineData("complete")]
    [InlineData("cancel")]
    public void Validate_WithKnownAction_HasNoErrors(string action)
    {
        _validator.TestValidate(new UpdateBookingStatusCommand(Guid.NewGuid(), action))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validate_WithMissingAction_HasActionError(string? action)
    {
        _validator.TestValidate(new UpdateBookingStatusCommand(Guid.NewGuid(), action!))
            .ShouldHaveValidationErrorFor(x => x.Action);
    }

    [Fact]
    public void Validate_WithEmptyBookingId_HasIdError()
    {
        _validator.TestValidate(new UpdateBookingStatusCommand(Guid.Empty, "confirm"))
            .ShouldHaveValidationErrorFor(x => x.BookingId);
    }

    [Fact]
    public void Validate_WithUnknownAction_HasNoErrors_BusinessRuleIsHandlersJob()
    {
        // « expedier » n'existe pas — mais c'est le handler qui doit répondre 422,
        // pas le validateur (parité avec UpdateOrderStatus).
        _validator.TestValidate(new UpdateBookingStatusCommand(Guid.NewGuid(), "expedier"))
            .ShouldNotHaveAnyValidationErrors();
    }
}
