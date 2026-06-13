using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.UpdateBookingStatus;

public sealed class UpdateBookingStatusCommandValidator : AbstractValidator<UpdateBookingStatusCommand>
{
    public UpdateBookingStatusCommandValidator()
    {
        RuleFor(x => x.BookingId).NotEmpty();
        RuleFor(x => x.Action)
            .NotEmpty().WithMessage("L'action est requise.");
        // Une action non vide mais inconnue relève de la règle métier (422),
        // tranchée dans le handler — même idiome que UpdateOrderStatus.
    }
}
