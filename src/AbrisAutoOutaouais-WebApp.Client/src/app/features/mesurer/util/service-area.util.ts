/**
 * Zone de service AbrisTempo (D5) — base géographique + rayon, et calcul de distance pur
 * (Haversine) servant à signaler en douceur une adresse hors zone de livraison/installation.
 *
 * Avertissement NON BLOQUANT : ces constantes pilotent uniquement un message d'aide côté client
 * (signal + `aria-live`). Aucune règle serveur ne rejette une adresse hors zone — y ajouter un
 * `RuleFor` distance rééditerait la régression « Ontario → 422 » (L-004 §C1). Le socle serveur se
 * limite à un util Domain `GeoDistance` et un test prouvant le NON-rejet.
 *
 * MIROIR CROISÉ (L-007 / L-004) : `SERVICE_BASE` et `SERVICE_RADIUS_KM` sont la copie exacte des
 * constantes Domain `GeoDistance.ServiceBaseLat/Lng` et `GeoDistance.ServiceRadiusKm`. Si la base
 * de service déménage (nouveau dépôt) ou le rayon change, METTRE À JOUR LES DEUX côtés ensemble —
 * c'est un format partagé client↔serveur, épinglé par tests des deux côtés.
 */

/** Base de la zone de service (dépôt régional Gatineau). Miroir de `GeoDistance.ServiceBase*`. */
export const SERVICE_BASE = { lat: 45.4765, lng: -75.7013 } as const;

/** Rayon de la zone de service en km. Miroir de `GeoDistance.ServiceRadiusKm`. */
export const SERVICE_RADIUS_KM = 100;

/** Rayon terrestre moyen (km) utilisé par la formule de Haversine. */
const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Distance orthodromique (Haversine) en km entre deux points (lat/lng en degrés décimaux).
 * Fonction PURE — aucune dépendance Angular/DOM, testable telle quelle.
 */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Vrai si le point (lat/lng) est dans la zone de service (≤ `SERVICE_RADIUS_KM` de la base).
 * Coordonnées `null` (adresse non géocodée) → `false` n'est PAS l'intention : un point inconnu
 * ne doit pas être présenté comme « hors zone ». Le composant appelant garde donc lat/lng réels
 * et n'évalue cette fonction que sur des nombres ; ici on traite `null` comme « non hors zone »
 * en exigeant deux nombres finis.
 */
export function isWithinServiceArea(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    // Inconnu ⇒ on n'affirme PAS « hors zone » (pas d'avertissement sur une adresse non localisée).
    return true;
  }
  return haversineKm(SERVICE_BASE.lat, SERVICE_BASE.lng, lat, lng) <= SERVICE_RADIUS_KM;
}
