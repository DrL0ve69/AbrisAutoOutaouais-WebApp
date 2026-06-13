import { CLEARANCE_PER_SIDE_CM, VEHICLE_DIMS, VehicleType } from './vehicle-dims.const';

/**
 * Calcul du gabarit (« footprint ») de stationnement requis, en cm.
 *
 * Math PURE — aucune dépendance Angular/DOM, entièrement testable. Le résultat alimente
 * l'endpoint D2 `suggest-shelters`, qui exige deux entiers `1..2000` (sinon 422) : on
 * borne et on arrondit ICI, et on signale tout dépassement par `outOfRange` pour que l'UI
 * évite l'appel réseau (leçons L-004 / L-011).
 *
 * Règles (estimation de démonstration, documentées) :
 *  - Un véhicule          : requiredWidth = vWidth + 2·CLEARANCE ; requiredLength = vLength + 2·CLEARANCE.
 *  - Plusieurs véhicules  : modèle CÔTE À CÔTE.
 *      totalWidth  = Σ(largeurs) + CLEARANCE·(nbVéhicules + 1)   (un dégagement entre chaque
 *                    véhicule ET de part et d'autre de la rangée)
 *      totalLength = max(longueurs) + 2·CLEARANCE
 *    (Hypothèse : tous les véhicules sont alignés sur une seule rangée ; on ne modélise pas
 *    le stationnement en profondeur.)
 *  - Saisie manuelle      : passe-through (l'utilisateur fournit déjà le gabarit).
 *
 * Arrondi : TOUJOURS `Math.ceil` au cm — ne jamais sous-dimensionner un abri.
 * Bornes  : chaque dimension doit rester dans `[MIN_CM, MAX_CM]` ; sinon `outOfRange = true`.
 */

/** Bornes acceptées par le validateur serveur D2 (entiers, > 0 ∧ ≤ 2000). */
export const FOOTPRINT_MIN_CM = 1;
export const FOOTPRINT_MAX_CM = 2000;

/** Gabarit calculé. `outOfRange` ⇒ ne PAS appeler D2 (l'UI affiche un message). */
export interface Footprint {
  readonly widthCm: number;
  readonly lengthCm: number;
  /** Vrai si une dimension (après arrondi) sort de `[1, 2000]` → pas d'appel D2. */
  readonly outOfRange: boolean;
}

/** Une sélection de véhicules : un type et une quantité (≥ 1). */
export interface VehicleSelection {
  readonly type: VehicleType;
  readonly quantity: number;
}

/** Arrondit au cm supérieur puis évalue les bornes `[1, 2000]`. */
function finalize(widthRaw: number, lengthRaw: number): Footprint {
  const widthCm = Math.ceil(widthRaw);
  const lengthCm = Math.ceil(lengthRaw);
  const inRange =
    widthCm >= FOOTPRINT_MIN_CM &&
    widthCm <= FOOTPRINT_MAX_CM &&
    lengthCm >= FOOTPRINT_MIN_CM &&
    lengthCm <= FOOTPRINT_MAX_CM;
  return { widthCm, lengthCm, outOfRange: !inRange };
}

/**
 * Gabarit requis pour une ou plusieurs sélections de véhicules (côte à côte).
 * Ignore les quantités ≤ 0. Retourne `outOfRange` si aucun véhicule n'est sélectionné.
 */
export function footprintForVehicles(selections: readonly VehicleSelection[]): Footprint {
  // Aplatit les sélections en une liste de dimensions individuelles.
  const dims = selections
    .filter(s => s.quantity > 0)
    .flatMap(s => Array.from({ length: Math.floor(s.quantity) }, () => VEHICLE_DIMS[s.type]));

  if (dims.length === 0) {
    return { widthCm: 0, lengthCm: 0, outOfRange: true };
  }

  if (dims.length === 1) {
    const v = dims[0];
    return finalize(v.widthCm + 2 * CLEARANCE_PER_SIDE_CM, v.lengthCm + 2 * CLEARANCE_PER_SIDE_CM);
  }

  // Modèle côte à côte : largeurs additionnées + un dégagement entre/autour de chaque véhicule.
  const totalWidth =
    dims.reduce((sum, v) => sum + v.widthCm, 0) + CLEARANCE_PER_SIDE_CM * (dims.length + 1);
  const totalLength = Math.max(...dims.map(v => v.lengthCm)) + 2 * CLEARANCE_PER_SIDE_CM;
  return finalize(totalWidth, totalLength);
}

/**
 * Gabarit à partir d'une saisie manuelle (cm). Passe-through : on arrondit au cm supérieur
 * et on borne. Une valeur absente / non finie / ≤ 0 est considérée hors plage.
 */
export function footprintFromManual(widthCm: number, lengthCm: number): Footprint {
  if (
    !Number.isFinite(widthCm) ||
    !Number.isFinite(lengthCm) ||
    widthCm <= 0 ||
    lengthCm <= 0
  ) {
    return { widthCm: Math.max(0, Math.ceil(widthCm || 0)), lengthCm: Math.max(0, Math.ceil(lengthCm || 0)), outOfRange: true };
  }
  return finalize(widthCm, lengthCm);
}
