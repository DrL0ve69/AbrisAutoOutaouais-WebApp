/**
 * Navigation clavier d'un groupe `role="radiogroup"` conforme à l'APG ARIA
 * (roving tabindex + flèches + Home/End). Logique PURE et testable : les composants
 * calculent l'index sélectionné suivant puis déplacent le focus eux-mêmes.
 *
 * Pattern APG : une seule option dans l'ordre de tabulation (la sélectionnée, `tabindex=0`),
 * les autres `tabindex=-1` ; les flèches déplacent ET sélectionnent (avec bouclage), Home/End
 * vont à la première/dernière. Voir https://www.w3.org/WAI/ARIA/apg/patterns/radio/.
 */

/** Touches qui pilotent un radiogroup APG (les autres sont ignorées par le handler). */
export const RADIO_NAV_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];

/** Vrai si la touche doit être traitée (et son comportement par défaut neutralisé). */
export function isRadioNavKey(key: string): boolean {
  return RADIO_NAV_KEYS.includes(key);
}

/**
 * Index sélectionné suivant pour la touche pressée, dans un groupe de `count` options.
 * Flèches avant/arrière avec bouclage ; Home → 0 ; End → dernier. Pour une touche non
 * gérée (ou `count <= 0`), renvoie `current` inchangé.
 */
export function nextRadioIndex(key: string, current: number, count: number): number {
  if (count <= 0) return current;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return current;
  }
}
