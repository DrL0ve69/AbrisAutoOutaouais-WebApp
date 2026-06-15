namespace AbrisAutoOutaouais_WebApp.Domain.Common;

/// <summary>
/// Distance géographique (Haversine) et zone de service AbrisTempo.
///
/// <para>
/// MIROIR CROISÉ CLIENT↔SERVEUR (L-007 / L-004). Les constantes <see cref="ServiceBaseLat"/>,
/// <see cref="ServiceBaseLng"/> et <see cref="ServiceRadiusKm"/> sont la copie EXACTE de
/// <c>service-area.util.ts</c> (front). Si la base de service déménage ou que le rayon change,
/// METTRE À JOUR LES DEUX côtés ensemble — c'est un format partagé, épinglé par tests des deux côtés.
/// </para>
///
/// <para>
/// SOCLE SEULEMENT — NON BLOQUANT (D5). Cet utilitaire fournit la distance et le seuil ; il
/// n'est volontairement câblé dans AUCUN validateur FluentValidation. Ajouter un
/// <c>RuleFor(distance)</c> rééditerait la régression « province hors-Québec → 422 » (L-004 §C1).
/// L'avertissement « hors zone » vit côté client (signal + aria-live). Côté serveur, seul un test
/// de NON-rejet (une adresse hors-zone valide PASSE) protège l'invariant.
/// </para>
/// </summary>
public static class GeoDistance
{
    /// <summary>Latitude de la base de service (dépôt régional Gatineau). Miroir front.</summary>
    public const double ServiceBaseLat = 45.4765;

    /// <summary>Longitude de la base de service. Miroir front.</summary>
    public const double ServiceBaseLng = -75.7013;

    /// <summary>Rayon de la zone de service en km. Miroir front.</summary>
    public const double ServiceRadiusKm = 100;

    /// <summary>Rayon terrestre moyen (km) utilisé par la formule de Haversine.</summary>
    private const double EarthRadiusKm = 6371;

    /// <summary>
    /// Distance orthodromique (Haversine) en km entre deux points (lat/lng en degrés décimaux).
    /// Fonction pure, sans dépendance externe.
    /// </summary>
    public static double HaversineKm(double aLat, double aLng, double bLat, double bLng)
    {
        var dLat = ToRad(bLat - aLat);
        var dLng = ToRad(bLng - aLng);
        var lat1 = ToRad(aLat);
        var lat2 = ToRad(bLat);

        var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * EarthRadiusKm * Math.Asin(Math.Sqrt(h));
    }

    /// <summary>
    /// Vrai si le point (lat/lng) est dans la zone de service (≤ <see cref="ServiceRadiusKm"/>
    /// de la base). Informatif uniquement : n'est utilisé par aucune règle bloquante (D5).
    /// </summary>
    public static bool IsWithinServiceArea(double lat, double lng)
        => HaversineKm(ServiceBaseLat, ServiceBaseLng, lat, lng) <= ServiceRadiusKm;

    private static double ToRad(double deg) => deg * Math.PI / 180;
}
