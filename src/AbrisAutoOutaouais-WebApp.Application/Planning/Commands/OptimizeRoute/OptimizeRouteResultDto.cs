namespace AbrisAutoOutaouais_WebApp.Application.Planning.Commands.OptimizeRoute;

/// <summary>
/// Un arrêt de la tournée optimisée (US-11.3). <see cref="SlotStart"/> est l'heure UTC BRUTE du
/// créneau (le client la rend en fuseau local — L-044). <see cref="LegKm"/> est la distance (km,
/// orthodromique) depuis l'arrêt précédent (ou la base pour le premier). <see cref="Rescheduled"/>
/// distingue les RDV effectivement recalés sur la grille de ceux qui, faute de créneau valide
/// restant (surplus), ont conservé leur heure d'origine.
/// </summary>
public sealed record OptimizedStopDto(
    Guid BookingId,
    int Order,
    DateTime SlotStart,
    string CustomerName,
    string City,
    double LegKm,
    bool Rescheduled);

/// <summary>
/// Résultat de l'optimisation d'une tournée pour une journée (US-11.3) : les arrêts dans l'ordre de
/// visite, les RDV exclus (sans coordonnées — pas de backfill automatique) et la distance totale.
/// </summary>
public sealed record OptimizeRouteResultDto(
    DateOnly Date,
    IReadOnlyList<OptimizedStopDto> Stops,
    IReadOnlyList<Guid> ExcludedBookingIds,
    double TotalKm);
