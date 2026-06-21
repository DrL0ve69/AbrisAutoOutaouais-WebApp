/**
 * Miroir EXACT des DTO de SUGGESTION serveur (EPIC 10, US-10.1 —
 * `GET /shelters/suggest?requiredWidthCm=&requiredLengthCm=`).
 *
 * À garder synchro avec, côté serveur :
 *  - `ShelterFitResultDto` (catégorie + plus grande largeur retenue + modèles)
 *  - `ShelterFitModelDto`  (modèle compatible + longueurs admissibles, déjà bornées)
 *
 * JSON .NET camelCase. Les longueurs (`availableLengthsCm`) sont déjà calculées et bornées
 * côté serveur (mesure, longueur max du modèle, plafond 40 pi) — on les affiche telles quelles.
 */

/** Un modèle d'abri compatible avec l'empreinte mesurée. */
export interface ShelterFitModel {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** Largeur fixe du modèle (cm) — « une largeur = un modèle » (post-EPIC 9). */
  readonly widthCm: number;
  /** Prix de base en DOLLARS (longueur minimale, 0 arche supplémentaire). */
  readonly basePrice: number;
  readonly minLengthCm: number;
  readonly lengthStepCm: number;
  /** Longueurs admissibles (cm), triées croissant, déjà bornées par le serveur. */
  readonly availableLengthsCm: readonly number[];
}

/** Résultat de suggestion agrégé par CATÉGORIE. */
export interface ShelterFitResult {
  readonly categorySlug: string;
  readonly categoryName: string;
  /** Plus grande largeur (cm) parmi les modèles retenus de la catégorie. */
  readonly categoryMaxWidthCm: number;
  readonly models: readonly ShelterFitModel[];
}
