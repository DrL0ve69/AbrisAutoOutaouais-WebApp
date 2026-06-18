import { cmToFeet } from './units.util';

/**
 * Formatage d'une longueur canonique (cm) en pieds/pouces pour l'AFFICHAGE du configurateur
 * (EPIC 9.3). Le centimètre reste l'unité canonique (cf. `units.util`) ; on convertit seulement
 * à la frontière de l'UI. Réutilise `cmToFeet` (point de conversion unique — L-004) ; ce module
 * NE MODIFIE PAS `units.util`.
 *
 * Règle : on arrondit au POUCE le plus proche (1 pi = 12 po), puis on décompose en pieds + pouces.
 * Les pouces nuls sont omis (« 11 pi » plutôt que « 11 pi 0 po »). Exemples :
 *   335 cm → 131,9 po → 132 po → « 11 pi »
 *   198 cm → 77,95 po → 78 po  → « 6 pi 6 po »
 */
export function formatFeetInches(cm: number): string {
  // Arrondi au pouce le plus proche, puis décomposition (évite « 6 pi 12 po »).
  const totalInches = Math.round(cmToFeet(cm) * 12);
  const feet = Math.trunc(totalInches / 12);
  const inches = totalInches % 12;
  return inches === 0 ? `${feet} pi` : `${feet} pi ${inches} po`;
}
