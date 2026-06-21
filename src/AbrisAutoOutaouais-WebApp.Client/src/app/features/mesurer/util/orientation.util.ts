import { CLEARANCE_PER_SIDE_CM, VEHICLE_DIMS } from './vehicle-dims.const';
import { Footprint, VehicleSelection, finalizeFootprint } from './footprint.util';

/**
 * Orientation du stationnement de PLUSIEURS véhicules (US-10.2) :
 *  - `side-by-side` : les véhicules sont alignés sur une seule rangée (modèle par défaut) ;
 *  - `behind`       : les véhicules sont les uns DERRIÈRE les autres (en profondeur).
 */
export type ParkingOrientation = 'side-by-side' | 'behind';

/** Aplatit les sélections (quantité > 0) en une liste de dimensions individuelles. */
function flatten(selections: readonly VehicleSelection[]) {
  return selections
    .filter(s => s.quantity > 0)
    .flatMap(s => Array.from({ length: Math.floor(s.quantity) }, () => VEHICLE_DIMS[s.type]));
}

/**
 * Gabarit requis (cm) pour une ou plusieurs sélections de véhicules, selon l'orientation.
 *
 * Un seul véhicule : l'orientation n'a aucun effet (largeur/longueur + 2·dégagement chacune).
 * Plusieurs véhicules :
 *  - `side-by-side` (côte à côte, rangée unique) :
 *      totalWidth  = Σ(largeurs) + dégagement·(n + 1)
 *      totalLength = max(longueurs) + 2·dégagement
 *  - `behind` (les uns derrière les autres, en profondeur) :
 *      totalWidth  = max(largeurs) + 2·dégagement
 *      totalLength = Σ(longueurs) + dégagement·(n + 1)
 *
 * Le dégagement par côté est la constante UNIQUE `CLEARANCE_PER_SIDE_CM` (pas de nouvelle valeur).
 * Arrondi `Math.ceil` et bornage `[1, 2000]` par `finalizeFootprint` (mêmes garanties que le
 * modèle côte à côte). Aucune sélection → hors plage (`outOfRange`).
 */
export function footprintForVehiclesOriented(
  selections: readonly VehicleSelection[],
  orientation: ParkingOrientation,
): Footprint {
  const dims = flatten(selections);

  if (dims.length === 0) {
    return { widthCm: 0, lengthCm: 0, outOfRange: true };
  }

  if (dims.length === 1) {
    const v = dims[0];
    return finalizeFootprint(
      v.widthCm + 2 * CLEARANCE_PER_SIDE_CM,
      v.lengthCm + 2 * CLEARANCE_PER_SIDE_CM,
    );
  }

  const sumWidth = dims.reduce((sum, v) => sum + v.widthCm, 0);
  const sumLength = dims.reduce((sum, v) => sum + v.lengthCm, 0);
  const maxWidth = Math.max(...dims.map(v => v.widthCm));
  const maxLength = Math.max(...dims.map(v => v.lengthCm));
  const between = CLEARANCE_PER_SIDE_CM * (dims.length + 1);

  if (orientation === 'behind') {
    // En profondeur : longueurs additionnées + un dégagement entre/autour de chaque véhicule ;
    // largeur dominée par le véhicule le plus large + un dégagement de part et d'autre.
    return finalizeFootprint(maxWidth + 2 * CLEARANCE_PER_SIDE_CM, sumLength + between);
  }

  // Côte à côte (défaut) : largeurs additionnées + dégagement entre/autour, longueur = max + 2·dégagement.
  return finalizeFootprint(sumWidth + between, maxLength + 2 * CLEARANCE_PER_SIDE_CM);
}
