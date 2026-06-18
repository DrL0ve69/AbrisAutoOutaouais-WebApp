import type { Locator, Page } from '@playwright/test';

// ── Helpers de CALCUL DE CONTRASTE WCAG DIRECT, partagés par les gardes de contraste e2e ─────────
//
// Pourquoi un calcul direct plutôt qu'axe `color-contrast` : selon la cible, axe ne « voit » pas le
// problème (la valeur tapée dans un `<input>` n'est pas un nœud texte — L-016) ; et de toute façon
// `color-contrast` est DÉSACTIVÉ en vitest (L-016). On lit donc les couleurs COMPOSÉES réelles et on
// calcule le ratio WCAG nous-mêmes → garde non vacueuse (L-009/L-016), vivant en e2e (L-005).
//
// Même arithmétique que `auth-input-contrast.spec.ts` (EPIC 12 partie 1, qui reste autonome),
// factorisée ici pour les gardes de la partie 2 : `badge-tab-contrast.spec.ts`,
// `form-focus-contrast.spec.ts` et `primary-surface-contrast.spec.ts`.

export type Rgb = [number, number, number];

/** Force le thème AVANT le 1er rendu via localStorage (clé lue par ThemeService → html[data-theme]). */
export function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

/** Luminance relative WCAG d'une couleur `rgb(r, g, b)` (alpha ignoré : fonds opaques). */
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function parseRgb(value: string): Rgb {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Couleur non parsable : ${value}`);
  const [r, g, b] = m[1].split(',').map((n) => parseFloat(n.trim()));
  return [r, g, b];
}

/**
 * Lit la couleur de texte et le fond COMPOSÉS réels d'un élément rendu. Si le fond de l'élément est
 * transparent, on remonte au premier ancêtre opaque (le ratio se mesure sur le fond effectivement vu).
 */
export async function composedColors(
  locator: Locator,
): Promise<{ color: string; background: string }> {
  return locator.evaluate((el: HTMLElement) => {
    const fg = getComputedStyle(el).color;
    let node: HTMLElement | null = el;
    let bg = getComputedStyle(el).backgroundColor;
    while (node && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      node = node.parentElement;
      bg = node ? getComputedStyle(node).backgroundColor : 'rgb(255, 255, 255)';
    }
    return { color: fg, background: bg };
  });
}

/** Ratio WCAG du texte composé d'un élément sur son fond composé effectif. */
export async function measuredContrast(locator: Locator): Promise<number> {
  const { color, background } = await composedColors(locator);
  return contrastRatio(parseRgb(color), parseRgb(background));
}
