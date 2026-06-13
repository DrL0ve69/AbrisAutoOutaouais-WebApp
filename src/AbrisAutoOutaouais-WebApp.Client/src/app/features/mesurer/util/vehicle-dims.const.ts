/**
 * Dimensions hors-tout réalistes par type de véhicule (en cm) — source UNIQUE pour le
 * calculateur de gabarit (leçon L-004 : une valeur partagée, un seul endroit).
 *
 * Les libellés affichés (i18n) vivent dans le composant `vehicle-calculator`, PAS ici :
 * cette constante ne porte que de la donnée numérique stable, indépendante de la locale.
 *
 * Valeurs indicatives (longueur × largeur hors-tout, miroirs inclus arrondis) :
 *  - compact     : ~430 × 180 (ex. Honda Civic)
 *  - berline     : ~480 × 190 (valeur spec D3)
 *  - vus         : ~480 × 195 (ex. RAV4 / CR-V)
 *  - pickup      : ~670 × 203 (Ford F-150, valeur spec D3)
 *  - fourgonnette: ~520 × 200 (ex. minivan)
 */
export interface VehicleDim {
  readonly widthCm: number;
  readonly lengthCm: number;
}

export type VehicleType = 'compact' | 'berline' | 'vus' | 'pickup' | 'fourgonnette';

export const VEHICLE_DIMS: Readonly<Record<VehicleType, VehicleDim>> = {
  compact: { widthCm: 180, lengthCm: 430 },
  berline: { widthCm: 190, lengthCm: 480 },
  vus: { widthCm: 195, lengthCm: 480 },
  pickup: { widthCm: 203, lengthCm: 670 },
  fourgonnette: { widthCm: 200, lengthCm: 520 },
} as const;

/**
 * Dégagement requis de CHAQUE côté du gabarit (cm) — espace pour ouvrir les portières,
 * circuler et monter l'abri autour du ou des véhicule(s). Appliqué sur les quatre côtés.
 */
export const CLEARANCE_PER_SIDE_CM = 60;
