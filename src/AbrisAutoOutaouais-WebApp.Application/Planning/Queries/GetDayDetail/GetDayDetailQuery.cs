using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Queries.GetDayDetail;

/// <summary>
/// Détail d'une journée du planning (US-11.2) : RDV du jour + tous les employés (Staff) avec leurs
/// heures pour cette date. Lecture réservée à <c>StaffOrAbove</c> ; Admin et Staff voient tout.
/// </summary>
public sealed record GetDayDetailQuery(DateOnly Date) : IQuery<DayDetailDto>;
