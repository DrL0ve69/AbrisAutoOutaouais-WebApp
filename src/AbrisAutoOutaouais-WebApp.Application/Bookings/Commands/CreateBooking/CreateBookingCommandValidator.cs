using AbrisAutoOutaouais_WebApp.Application.Common.Validators;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

/// <summary>
/// Valide une demande de réservation. L'adresse passe par la source canonique unique
/// (<see cref="AddressDtoValidator"/>) — même format que le profil/l'autofill (leçon L-004).
/// L'alignement du créneau sur la grille de 2 h et son caractère futur restent vérifiés par
/// l'agrégat <c>BookingSlot.Create()</c> (règle métier du domaine), pas ici.
/// </summary>
public sealed class CreateBookingCommandValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingCommandValidator()
    {
        RuleFor(x => x.SlotStart)
            .NotEmpty().WithMessage("Le créneau est requis.");

        RuleFor(x => x.Type)
            .IsInEnum();

        RuleFor(x => x.Address)
            .NotNull().WithMessage("L'adresse est requise.")
            .SetValidator(new AddressDtoValidator());
    }
}
