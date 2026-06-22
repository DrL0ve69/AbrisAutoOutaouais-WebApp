namespace AbrisAutoOutaouais_WebApp.Domain.Common;

/// <summary>
/// Un arrêt de tournée à ordonner : son identité métier (<paramref name="Id"/>) et ses coordonnées
/// géographiques (degrés décimaux). Type pur sans dépendance — manipulé par <see cref="RouteOptimizer"/>.
/// </summary>
public sealed record RouteStop(Guid Id, double Lat, double Lng);

/// <summary>
/// Un arrêt ordonné dans la tournée optimisée : sa position (<paramref name="Order"/>, base 0),
/// l'arrêt lui-même et la distance (km, orthodromique) du segment qui y mène depuis l'arrêt précédent
/// (ou depuis la base de service pour le premier arrêt).
/// </summary>
public sealed record OrderedStop(int Order, RouteStop Stop, double LegKm);

/// <summary>
/// Résultat d'une optimisation : les arrêts dans l'ordre de visite et la distance totale parcourue
/// (km), base de service incluse comme point de départ.
/// </summary>
public sealed record RouteResult(IReadOnlyList<OrderedStop> Stops, double TotalKm);

/// <summary>
/// Heuristique « plus proche voisin » (nearest-neighbour) pour ordonner une tournée d'arrêts à
/// partir d'une base de départ fixe (US-11.3). Fonction PURE et statique, sans dépendance externe :
/// pas d'API de routage tierce (budget « zéro frais », cf. <c>.claude/rules/budget-free-tier.md</c>) —
/// la distance utilise la formule de Haversine de <see cref="GeoDistance"/>.
///
/// <para>
/// L'algorithme n'est pas optimal au sens du voyageur de commerce (NP-difficile) mais donne un ordre
/// raisonnable en O(n²), suffisant pour le faible volume de RDV quotidiens d'une entreprise régionale.
/// L'admin valide visuellement le résultat (décision propriétaire).
/// </para>
/// </summary>
public static class RouteOptimizer
{
    /// <summary>
    /// Ordonne les <paramref name="stops"/> par plus proche voisin depuis (<paramref name="baseLat"/>,
    /// <paramref name="baseLng"/>). À chaque étape, on choisit l'arrêt non visité le plus proche du
    /// point courant. Retourne l'ordre, la distance de chaque segment et le total. Une liste vide
    /// renvoie un résultat vide (TotalKm = 0). Déterministe : à distance égale, le premier rencontré
    /// dans l'ordre d'entrée est choisi.
    /// </summary>
    public static RouteResult Optimize(IReadOnlyList<RouteStop> stops, double baseLat, double baseLng)
    {
        ArgumentNullException.ThrowIfNull(stops);

        if (stops.Count == 0)
            return new RouteResult([], 0);

        var remaining = stops.ToList();
        var ordered = new List<OrderedStop>(remaining.Count);

        var currentLat = baseLat;
        var currentLng = baseLng;
        var totalKm = 0.0;
        var order = 0;

        while (remaining.Count > 0)
        {
            var bestIndex = 0;
            var bestKm = GeoDistance.HaversineKm(currentLat, currentLng, remaining[0].Lat, remaining[0].Lng);

            for (var i = 1; i < remaining.Count; i++)
            {
                var km = GeoDistance.HaversineKm(currentLat, currentLng, remaining[i].Lat, remaining[i].Lng);
                if (km < bestKm)
                {
                    bestKm = km;
                    bestIndex = i;
                }
            }

            var next = remaining[bestIndex];
            remaining.RemoveAt(bestIndex);

            ordered.Add(new OrderedStop(order, next, bestKm));
            totalKm += bestKm;
            order++;

            currentLat = next.Lat;
            currentLng = next.Lng;
        }

        return new RouteResult(ordered, totalKm);
    }
}
