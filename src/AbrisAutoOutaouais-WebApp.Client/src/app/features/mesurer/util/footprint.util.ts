import { footprintForVehiclesOriented } from './orientation.util';
import { Footprint, finalizeFootprint, VehicleSelection } from './footprint-core.util';

/**
 * Calcul du gabarit (« footprint ») de stationnement requis, en cm.
 *
 * Math PURE — aucune dépendance Angular/DOM, entièrement testable. Le résultat alimente
 * l'endpoint de suggestion (`/shelters/suggest`), qui exige deux entiers `1..2000` (sinon 422) :
 * on borne et on arrondit ICI, et on signale tout dépassement par `outOfRange` pour que l'UI
 * évite l'appel réseau (leçons L-004 / L-011).
 *
 * Règles (estimation de démonstration, documentées) :
 *  - Un véhicule          : requiredWidth = vWidth + 2·CLEARANCE ; requiredLength = vLength + 2·CLEARANCE.
 *  - Plusieurs véhicules  : selon l'ORIENTATION (côte à côte par défaut, ou les uns derrière les
 *    autres) — la logique vit dans `orientation.util` (`footprintForVehiclesOriented`) ; cette
 *    fonction historique délègue au modèle côte à côte pour préserver son API.
 *  - Saisie manuelle      : passe-through (l'utilisateur fournit déjà le gabarit).
 *
 * Arrondi : TOUJOURS `Math.ceil` au cm — ne jamais sous-dimensionner un abri.
 * Bornes  : chaque dimension doit rester dans `[MIN_CM, MAX_CM]` ; sinon `outOfRange = true`.
 *
 * Les types/bornes/`finalizeFootprint` partagés vivent dans `footprint-core.util` (noyau neutre,
 * pour éviter un cycle d'import avec `orientation.util`) ; on les RÉEXPORTE ici pour préserver
 * l'API publique historique (les consommateurs continuent d'importer depuis `footprint.util`).
 */

export {
  FOOTPRINT_MIN_CM,
  FOOTPRINT_MAX_CM,
  finalizeFootprint,
} from './footprint-core.util';
export type { Footprint, VehicleSelection } from './footprint-core.util';

/**
 * Gabarit requis pour une ou plusieurs sélections de véhicules (modèle CÔTE À CÔTE).
 * Conserve l'API historique : délègue à `footprintForVehiclesOriented(..., 'side-by-side')`.
 * Ignore les quantités ≤ 0. Retourne `outOfRange` si aucun véhicule n'est sélectionné.
 */
export function footprintForVehicles(selections: readonly VehicleSelection[]): Footprint {
  return footprintForVehiclesOriented(selections, 'side-by-side');
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
  return finalizeFootprint(widthCm, lengthCm);
}
