/**
 * Conversion d'unités de longueur pour l'outil `/mesurer`.
 *
 * Le **centimètre est l'unité canonique** : toute la logique (calcul de gabarit dans
 * `footprint.util`, dimensions véhicules, paramètres de l'endpoint `/shelters/suggest`,
 * DTO modèle) raisonne en cm. Les **pieds ne servent QU'À l'AFFICHAGE et à la SAISIE** —
 * on convertit aux frontières de l'UI, jamais dans le domaine (décision « cm-canonique +
 * affichage en pieds »). Garder ces deux fonctions comme seul point de conversion (L-004).
 */

/** 1 pied = 30,48 cm (définition exacte). */
export const CM_PER_FOOT = 30.48;

/** Pieds → centimètres (pour convertir une SAISIE en pieds vers le canonique cm). */
export function feetToCm(feet: number): number {
  return feet * CM_PER_FOOT;
}

/** Centimètres → pieds (pour AFFICHER une valeur canonique cm en pieds). */
export function cmToFeet(cm: number): number {
  return cm / CM_PER_FOOT;
}
