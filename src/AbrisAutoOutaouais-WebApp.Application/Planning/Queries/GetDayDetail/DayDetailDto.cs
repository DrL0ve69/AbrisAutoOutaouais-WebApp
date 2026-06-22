using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetCalendarBookings;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Queries.GetDayDetail;

/// <summary>
/// Détail d'une journée pour le planning (US-11.2) : les RDV du jour (réutilise le
/// <see cref="CalendarBookingDto"/> existant du calendrier — aucune duplication) et la liste de
/// TOUS les employés avec leurs heures pour ce jour (présents ou non).
/// </summary>
public sealed record DayDetailDto(
    DateOnly Date,
    IReadOnlyList<CalendarBookingDto> Bookings,
    IReadOnlyList<StaffWorkHoursDto> Staff);
