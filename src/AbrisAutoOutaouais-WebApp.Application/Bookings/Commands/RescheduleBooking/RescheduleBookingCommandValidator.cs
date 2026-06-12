using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.RescheduleBooking;

public sealed class RescheduleBookingCommandValidator : AbstractValidator<RescheduleBookingCommand>
{
    public RescheduleBookingCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.NewSlotStart)
            .NotEmpty().WithMessage("Le nouveau créneau est requis.");
    }
}
