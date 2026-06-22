using AbrisAutoOutaouais_WebApp.Application.Bookings.Common;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Common;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Commands.OptimizeRoute;

/// <summary>
/// Optimise la tournée des RDV d'une journée (US-11.3).
/// <para>
/// Charge les <see cref="BookingSlot"/> du jour EN TRACKING (on mute leurs heures), de statut
/// <c>Pending</c> ou <c>Confirmed</c> (les seuls recalables : <see cref="BookingSlot.Reschedule"/>
/// refuse Completed/Cancelled). La fenêtre « même jour » par début de créneau est correcte UNIQUEMENT
/// parce qu'un créneau est sous-journalier (<see cref="SlotRules.SlotDuration"/> = 2 h, &lt; 24 h) —
/// même hypothèse que <c>RescheduleBookingCommand</c> et <c>GetDayDetailQuery</c> (L-007).
/// </para>
/// <para>
/// Les RDV SANS coordonnées (<see cref="BookingSlot.Lat"/>/<see cref="BookingSlot.Lng"/> null) sont
/// EXCLUS de l'optimisation (pas de backfill automatique — décision propriétaire) et listés dans
/// <c>ExcludedBookingIds</c>. Les arrêts géolocalisés sont ordonnés par plus proche voisin depuis la
/// base de service (<see cref="GeoDistance.ServiceBaseLat"/>/<c>Lng</c>), puis recalés séquentiellement
/// sur les créneaux valides de la grille 2 h (08 h–17 h). Le SURPLUS (au-delà du nombre de créneaux de
/// la grille) garde son heure d'origine et est marqué <c>Rescheduled = false</c> — aucun créneau
/// invalide n'est créé. L'admin valide visuellement le résultat retourné.
/// </para>
/// </summary>
internal sealed class OptimizeRouteCommandHandler(
    IApplicationDbContext db,
    IIdentityService identity,
    IDateTimeProvider clock)
    : ICommandHandler<OptimizeRouteCommand, OptimizeRouteResultDto>
{
    public async Task<OptimizeRouteResultDto> HandleAsync(OptimizeRouteCommand command, CancellationToken ct)
    {
        var fromUtc = command.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toExclusiveUtc = command.Date.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // EN TRACKING (pas d'AsNoTracking) : on réécrit SlotStart via Reschedule. Seuls les RDV
        // recalables (Pending/Confirmed) — fenêtre par début de créneau, sous-journalier (L-007).
        var bookings = await db.BookingSlots
            .Where(b => b.SlotStart >= fromUtc && b.SlotStart < toExclusiveUtc
                && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Confirmed))
            .OrderBy(b => b.SlotStart)
            .ToListAsync(ct);

        // Sépare les RDV géolocalisés (optimisables) de ceux sans coordonnées (exclus, pas de backfill).
        var locatable = bookings.Where(b => b.Lat is not null && b.Lng is not null).ToList();
        var excludedIds = bookings
            .Where(b => b.Lat is null || b.Lng is null)
            .Select(b => b.Id)
            .ToList();

        // Plus proche voisin depuis la base de service (heuristique maison, sans API tierce).
        var stops = locatable
            .Select(b => new RouteStop(b.Id, b.Lat!.Value, b.Lng!.Value))
            .ToList();
        var optimized = RouteOptimizer.Optimize(
            stops, GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng);

        // Créneaux valides de la grille 2 h (08 h, 10 h, 12 h, 14 h, 15 h exclu car +2 h > 17 h) pour CE
        // jour, en UTC. On recale dans l'ordre optimisé jusqu'à épuisement ; le surplus garde son heure.
        var gridSlots = BuildDayGridSlots(command.Date);

        // Heures « gelées » : tout RDV qui CONSERVE son heure d'origine occupe déjà ce créneau et ne
        // doit jamais être écrasé par un recalage (sinon double-réservation que RescheduleBooking
        // interdit via SlotRules.Overlaps). On amorce avec les RDV exclus (sans coords) ; on y ajoute
        // au fil de l'eau chaque recalable devenu surplus (cf. boucle ci-dessous). Décision #4 : un
        // recalable sans créneau libre redevient surplus et garde son heure (Rescheduled = false).
        var frozenStarts = bookings
            .Where(b => b.Lat is null || b.Lng is null)
            .Select(b => b.SlotStart)
            .ToList();

        var byId = locatable.ToDictionary(b => b.Id);
        var resultStops = new List<OptimizedStopDto>(optimized.Stops.Count);

        // Mémoïsation des noms de client : plusieurs RDV peuvent partager le même client (évite N+1).
        var nameCache = new Dictionary<Guid, string>();

        // Curseur sur les créneaux de grille : on n'avance qu'après une assignation réussie, afin de
        // « tasser » les RDV sur les créneaux libres restants plutôt que de laisser des trous.
        var nextGrid = 0;

        foreach (var ordered in optimized.Stops)
        {
            var booking = byId[ordered.Stop.Id];
            var rescheduled = false;

            // Cherche le prochain créneau de grille à la fois FUTUR (Reschedule l'exige) et LIBRE —
            // c.-à-d. qui ne chevauche aucune heure gelée (RDV exclu ou surplus). On réutilise
            // SlotRules.Overlaps (même règle anti-double-réservation que RescheduleBooking).
            while (nextGrid < gridSlots.Count && !IsGridSlotFree(gridSlots[nextGrid], booking.DurationMin, frozenStarts, clock.UtcNow))
                nextGrid++;

            if (nextGrid < gridSlots.Count)
            {
                booking.Reschedule(gridSlots[nextGrid], clock.UtcNow);
                frozenStarts.Add(gridSlots[nextGrid]); // ce créneau est désormais occupé
                nextGrid++;
                rescheduled = true;
            }
            else
            {
                // Surplus : aucun créneau libre/futur → garde son heure d'origine, qui devient gelée
                // (un recalage ultérieur ne pourra pas la réutiliser). Aucun créneau invalide créé.
                frozenStarts.Add(booking.SlotStart);
            }

            var name = await ResolveCustomerNameAsync(booking.CustomerId, nameCache, ct);
            resultStops.Add(new OptimizedStopDto(
                booking.Id,
                ordered.Order,
                booking.SlotStart, // heure UTC brute (réécrite si recalé, sinon d'origine) — L-044
                name,
                booking.Address.City,
                ordered.LegKm,
                rescheduled));
        }

        await db.SaveChangesAsync(ct);

        return new OptimizeRouteResultDto(
            command.Date, resultStops, excludedIds, optimized.TotalKm);
    }

    /// <summary>
    /// Génère les débuts de créneau valides (UTC) de la grille 2 h sur 08 h–17 h pour
    /// <paramref name="date"/>, dans l'ordre chronologique. Réutilise <see cref="SlotRules"/> (source
    /// unique des horaires d'affaires) plutôt que de redéfinir les bornes.
    /// </summary>
    private static List<DateTime> BuildDayGridSlots(DateOnly date)
    {
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) + SlotRules.WorkStart;
        var dayEnd = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) + SlotRules.WorkEnd;

        var slots = new List<DateTime>();
        for (var slot = dayStart; slot + SlotRules.SlotDuration <= dayEnd; slot += SlotRules.SlotDuration)
            slots.Add(slot);
        return slots;
    }

    /// <summary>
    /// Vrai si le créneau de grille <paramref name="slotStart"/> est à la fois FUTUR (Reschedule
    /// l'exige) et LIBRE — il ne chevauche aucune heure gelée. Réutilise <see cref="SlotRules.Overlaps"/>
    /// (même règle anti-double-réservation que <c>RescheduleBookingCommand</c>) sur la grille 2 h.
    /// </summary>
    private static bool IsGridSlotFree(
        DateTime slotStart, int durationMin, IEnumerable<DateTime> frozenStarts, DateTime nowUtc)
    {
        if (slotStart <= nowUtc)
            return false;

        var slotDurationMin = (int)SlotRules.SlotDuration.TotalMinutes;
        return !frozenStarts.Any(
            frozen => SlotRules.Overlaps(slotStart, durationMin, frozen, slotDurationMin));
    }

    /// <summary>
    /// Nom complet du client via le port d'identité (l'Application ne référence pas AppUser).
    /// Mémoïse par <paramref name="customerId"/> dans <paramref name="cache"/> : plusieurs RDV
    /// peuvent partager le même client → on évite un appel <c>GetProfileAsync</c> par arrêt (N+1).
    /// </summary>
    private async Task<string> ResolveCustomerNameAsync(
        Guid customerId, Dictionary<Guid, string> cache, CancellationToken ct)
    {
        if (cache.TryGetValue(customerId, out var cached))
            return cached;

        var profile = await identity.GetProfileAsync(customerId, ct);
        var name = profile is null ? "—" : $"{profile.FirstName} {profile.LastName}".Trim();
        cache[customerId] = name;
        return name;
    }

    public ValueTask<OptimizeRouteResultDto> Handle(OptimizeRouteCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
