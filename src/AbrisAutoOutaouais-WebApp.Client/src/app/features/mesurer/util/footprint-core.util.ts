import { VehicleType } from './vehicle-dims.const';

/**
 * Noyau PARTAGÉ du calcul de gabarit (« footprint ») de stationnement, en cm.
 *
 * Ce module ne contient QUE les types et l'arrondi/bornage communs — il ne dépend d'aucun autre
 * util de gabarit. Il existe pour briser le cycle d'import entre `footprint.util` (modèle côte à
 * côte historique + saisie manuelle) et `orientation.util` (US-10.2, orientations multiples) :
 * les deux dépendent de CE noyau, jamais l'un de l'autre pour l'arrondi/bornage (source UNIQUE,
 * L-004). Math PURE — aucune dépendance Angular/DOM, entièrement testable.
 */

/** Bornes acceptées par le validateur serveur (entiers, > 0 ∧ ≤ 2000). */
export const FOOTPRINT_MIN_CM = 1;
export const FOOTPRINT_MAX_CM = 2000;

/** Gabarit calculé. `outOfRange` ⇒ ne PAS appeler l'endpoint de suggestion (l'UI affiche un message). */
export interface Footprint {
  readonly widthCm: number;
  readonly lengthCm: number;
  /** Vrai si une dimension (après arrondi) sort de `[1, 2000]` → pas d'appel réseau. */
  readonly outOfRange: boolean;
}

/** Une sélection de véhicules : un type et une quantité (≥ 1). */
export interface VehicleSelection {
  readonly type: VehicleType;
  readonly quantity: number;
}

/**
 * Arrondit au cm supérieur (`Math.ceil` — ne jamais sous-dimensionner un abri) puis évalue les
 * bornes `[1, 2000]`. Source UNIQUE de l'arrondi/bornage, partagée par `footprint.util` et
 * `orientation.util` (L-004).
 */
export function finalizeFootprint(widthRaw: number, lengthRaw: number): Footprint {
  const widthCm = Math.ceil(widthRaw);
  const lengthCm = Math.ceil(lengthRaw);
  const inRange =
    widthCm >= FOOTPRINT_MIN_CM &&
    widthCm <= FOOTPRINT_MAX_CM &&
    lengthCm >= FOOTPRINT_MIN_CM &&
    lengthCm <= FOOTPRINT_MAX_CM;
  return { widthCm, lengthCm, outOfRange: !inRange };
}
