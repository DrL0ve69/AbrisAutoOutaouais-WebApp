/**
 * Mesure exacte d'un rectangle dessiné sur la carte satellite (`/mesurer`).
 *
 * POURQUOI par arête et NON par boîte englobante (bbox) — L-034 :
 * `turf.bbox()` produit une boîte ALIGNÉE AUX AXES (min/max lat-lng). Pour une allée qui
 * n'est pas orientée Nord–Sud, cette boîte est toujours plus grande que l'empreinte réelle :
 * un stationnement 3 m × 6 m pivoté à 45° y lit ~6,4 m × 6,4 m, ce qui suggère un abri trop
 * grand (et plus cher). On mesure donc les 4 arêtes du quadrilatère par distance
 * great-circle (haversine) et on apparie les côtés opposés — invariant à l'orientation.
 *
 * Util PUR : aucun import Angular / DOM / Leaflet / turf (haversine codée à la main, ~10 lignes,
 * idiome déjà présent dans le repo ; on n'ajoute pas `@turf/distance`, présent seulement en
 * transitif — cf. règle « coder le patron soi-même quand il est simple »).
 */

/** Dimensions d'un rectangle mesuré, en mètres. */
export interface RectDimensionsM {
  readonly widthM: number;
  readonly lengthM: number;
}

/** Rayon moyen de la Terre (m) — convention haversine. */
const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Distance great-circle (m) entre deux points [lng, lat] (ordre GeoJSON). */
function haversineMeters(a: readonly [number, number], b: readonly [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Extrait l'anneau extérieur d'un Feature/Geometry Polygon GeoJSON, ou `null`. */
function outerRing(geojson: unknown): readonly (readonly [number, number])[] | null {
  if (geojson === null || typeof geojson !== 'object') return null;
  const geometry =
    'geometry' in geojson
      ? (geojson as { geometry: unknown }).geometry
      : geojson;
  if (geometry === null || typeof geometry !== 'object') return null;
  const geom = geometry as { type?: unknown; coordinates?: unknown };
  if (geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null;
  const ring = geom.coordinates[0];
  if (!Array.isArray(ring)) return null;
  // Chaque sommet doit être un couple numérique [lng, lat].
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
      return null;
    }
  }
  return ring.map((pt: number[]) => [pt[0], pt[1]] as const);
}

/**
 * Largeur/longueur (m) de tout QUADRILATÈRE GeoJSON, mesurées par arête (invariant à l'orientation).
 *
 * Un anneau GeoJSON ferme la boucle (1er sommet = dernier) → un quadrilatère = 5 positions.
 * On exige EXACTEMENT 4 sommets distincts (anneau de longueur 5) : sinon (polygone libre à
 * ≠4 sommets, triangle, pentagone, ou tracé dégénéré) on renvoie `null` et l'appelant retombe
 * sur la bbox.
 *
 * Pour le quadrilatère [A, B, C, D] : arêtes AB, BC, CD, DA ; côtés opposés (AB, CD) et (BC, DA).
 * largeur = moyenne de la paire la plus COURTE, longueur = moyenne de la paire la plus LONGUE
 * (cohérent avec `footprintFromManual(largeur, longueur)`). Cas nominal = un rectangle dessiné
 * (geoman `drawRectangle`) : la mesure est exacte. Pour un quadrilatère libre non rectangulaire
 * (parallélogramme/trapèze via `drawPolygon`), la moyenne des côtés opposés reste une
 * approximation raisonnable — et bien meilleure que la bbox alignée aux axes (L-034).
 */
export function rectDimensionsFromPolygon(geojson: unknown): RectDimensionsM | null {
  const ring = outerRing(geojson);
  if (ring === null) return null;

  // Anneau fermé attendu : 5 positions dont la 1re == la dernière → 4 sommets distincts.
  if (ring.length !== 5) return null;
  const first = ring[0];
  const last = ring[4];
  if (first[0] !== last[0] || first[1] !== last[1]) return null;

  const [a, b, c, d] = ring;

  const ab = haversineMeters(a, b);
  const bc = haversineMeters(b, c);
  const cd = haversineMeters(c, d);
  const da = haversineMeters(d, a);

  // Garde anti-dégénéré : une arête ~0 = sommets coïncidents → pas un vrai rectangle.
  const EPSILON_M = 1e-6;
  if (ab < EPSILON_M || bc < EPSILON_M || cd < EPSILON_M || da < EPSILON_M) {
    return null;
  }

  // Moyennes des paires de côtés opposés.
  const pair1 = (ab + cd) / 2;
  const pair2 = (bc + da) / 2;

  const widthM = Math.min(pair1, pair2);
  const lengthM = Math.max(pair1, pair2);
  return { widthM, lengthM };
}
