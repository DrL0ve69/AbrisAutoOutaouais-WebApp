using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;

/// <summary>
/// Toutes les réservations dont le créneau débute dans la fenêtre [From, To] (bornes incluses),
/// pour la vue planning en lecture seule. Admin ET Staff voient l'intégralité du calendrier —
/// aucun filtre par utilisateur dans cette sous-tâche (décision propriétaire, US-11.1).
/// </summary>
public sealed record GetCalendarBookingsQuery(DateOnly From, DateOnly To)
    : IQuery<IReadOnlyList<CalendarBookingDto>>;
