using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;

/// <summary>
/// Garde-fous de la fenêtre du calendrier : la borne de fin ne précède pas la borne de début,
/// et la plage est bornée (≤ 92 jours ≈ un trimestre) pour éviter un balayage non borné.
/// </summary>
public sealed class GetCalendarBookingsQueryValidator : AbstractValidator<GetCalendarBookingsQuery>
{
    /// <summary>Amplitude maximale autorisée pour une seule requête (en jours, bornes incluses).</summary>
    public const int MaxRangeDays = 92;

    public GetCalendarBookingsQueryValidator()
    {
        RuleFor(x => x.To)
            .GreaterThanOrEqualTo(x => x.From)
            .WithMessage("La date de fin doit être postérieure ou égale à la date de début.");

        RuleFor(x => x)
            .Must(x => x.To.DayNumber - x.From.DayNumber <= MaxRangeDays)
            .WithMessage($"La plage de dates ne peut excéder {MaxRangeDays} jours.")
            // N'évaluer la borne d'amplitude que si l'ordre From/To est cohérent
            // (sinon le message « fin avant début » suffit, pas de double erreur trompeuse).
            .When(x => x.To >= x.From);
    }
}
