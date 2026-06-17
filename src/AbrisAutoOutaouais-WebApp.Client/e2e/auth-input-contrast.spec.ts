import { test, expect, type Page } from '@playwright/test';

// ── e2e : contraste du TEXTE SAISI dans les champs au focus (EPIC 12) ─────────────────────────
//
// Bug d'origine (signalé par l'utilisateur) : dans register/login, au focus puis à la frappe, le
// texte saisi devenait illisible en THÈME SOMBRE — « blanc sur blanc ». Cause : `.field__input:focus`
// (auth.scss / reset.scss) posait `background: white` CODÉ EN DUR, alors que `color` reste
// `var(--color-text)` (≈ #f1f5f9 en sombre) → blanc sur blanc. Corrigé en remplaçant par le jeton
// de surface `var(--color-surface)` (= #fff en clair, #1a2736 en sombre, L-016/L-023).
//
// ⚠️ Pourquoi un calcul de contraste DIRECT et pas axe `color-contrast` : la valeur tapée dans un
// `<input>` n'est PAS un nœud texte du DOM — axe ne l'évalue donc pas (c'est précisément pourquoi
// le bug était invisible aux outils). On lit ici les couleurs COMPOSÉES réelles du champ focalisé
// et on calcule le ratio WCAG nous-mêmes (gate non vacueuse, L-009/L-016). Le contraste n'est de
// toute façon pas couvert en vitest (règle désactivée, L-016) → cette garde vit en e2e (L-005).

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

const ecrans = [
  { nom: 'connexion', chemin: '/auth' },
  { nom: 'inscription', chemin: '/auth?vue=inscription' },
] as const;

function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

/** Luminance relative WCAG d'une couleur `rgb(r, g, b)` (alpha ignoré : fonds opaques). */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Couleur non parsable : ${value}`);
  const [r, g, b] = m[1].split(',').map((n) => parseFloat(n.trim()));
  return [r, g, b];
}

for (const theme of themes) {
  for (const ecran of ecrans) {
    test(`champ ${ecran.nom} au focus + frappe : texte lisible (≥ 4.5:1) — ${theme.libelle}`, async ({
      page,
    }) => {
      await forceTheme(page, theme.id);
      await page.goto(ecran.chemin);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

      // Premier champ texte du formulaire (login : courriel/identifiant ; inscription : idem).
      const champ = page.getByRole('textbox').first();
      await expect(champ).toBeVisible();
      await champ.click(); // focus
      // SSR + hydratation : un `fill` one-shot peut être écrasé avant que le CVA soit câblé (L-012)
      // → on rejoue jusqu'à ce que la valeur tienne réellement dans le modèle de form.
      await expect(async () => {
        await champ.fill('Membre10'); // reproduit la saisie exacte du rapport utilisateur
        await expect(champ).toHaveValue('Membre10');
      }).toPass();
      await expect(champ).toBeFocused();

      // Couleurs COMPOSÉES réelles du champ focalisé. Si le fond du champ est transparent,
      // remonter au premier ancêtre opaque (robustesse — ici le champ pose un fond explicite).
      const { color, background } = await champ.evaluate((el: HTMLElement) => {
        const fg = getComputedStyle(el).color;
        let node: HTMLElement | null = el;
        let bg = getComputedStyle(el).backgroundColor;
        while (node && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
          node = node.parentElement;
          bg = node ? getComputedStyle(node).backgroundColor : 'rgb(255, 255, 255)';
        }
        return { color: fg, background: bg };
      });

      const ratio = contrastRatio(parseRgb(color), parseRgb(background));
      expect(
        ratio,
        `Contraste texte/fond du champ ${ecran.nom} (${theme.libelle}) : ${ratio.toFixed(
          2,
        )}:1 — texte ${color} sur fond ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
}
