import { test, expect, type Page } from '@playwright/test';
import { forceTheme, measuredContrast } from './support/contrast';

// ── e2e : contraste TEXTE/FOND de deux surfaces « marque » (EPIC 12 partie 2 — suite) ────────────
//
// Deux cibles de la MÊME classe de bug L-023/L-032 : texte blanc (`#fff`) posé sur `--color-primary`,
// qui BASCULE en thème sombre vers le rouge clair #f87171 → ≈2.77:1 (échec WCAG AA). Le correctif
// repointe ces surfaces sur des jetons marque-FIXES (`--color-red-600` #b91c1c + `--color-on-brand`
// #fff), non surchargés en sombre → ≈6.5:1 dans les deux thèmes.
//   • A — créneau sélectionné `.booking__slot--selected` (/installation, route publique).
//   • B — pastille d'étape courante `.mesurer__step--current .mesurer__step-num` (/mesurer).
// On calcule le ratio WCAG DIRECTEMENT sur les couleurs composées réelles, dans les deux thèmes :
// garde non vacueuse (L-009/L-016), vivant en e2e car le contraste n'est pas couvert en vitest (L-016).

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

// ── Cible A — créneau sélectionné `.booking__slot--selected` sur /installation ───────────────────
// /installation est PUBLIC (aucun authGuard — vérifié app.routes.ts). On mocke GET
// /bookings/available-slots avec un créneau futur fixe → un `.booking__slot` est rendu, qu'on
// sélectionne (clic) pour activer l'état `.booking__slot--selected`.

/** Créneau fixe demain à 09:00–11:00 (UTC) — date future stable, indépendante de l'heure du run. */
function buildSlot(): { start: string; end: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(13, 0, 0, 0); // 09:00 heure de l'Est ≈ 13:00 UTC — affichage non assertionné ici.
  const start = new Date(d);
  const end = new Date(d.getTime() + 2 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function mockSlots(page: Page): Promise<void> {
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: [buildSlot()] }),
  );
}

for (const theme of themes) {
  test(`créneau sélectionné lisible (≥ 4.5:1) — ${theme.libelle}`, async ({ page }) => {
    await forceTheme(page, theme.id);
    await mockSlots(page);
    await page.goto('/installation');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // Le 1er créneau rendu — on le sélectionne pour activer l'état `--selected`.
    const slot = page.locator('.booking__slot').first();
    await expect(slot).toBeVisible();
    await slot.click();

    // Cible scopée par CLASSE (pas de getByRole nu — L-010), doublée d'un positif (rendu réel).
    const selected = page.locator('.booking__slot--selected');
    await expect(selected).toBeVisible();

    const ratio = await measuredContrast(selected);
    expect(
      ratio,
      `Contraste du créneau sélectionné (${theme.libelle}) : ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
}

// ── Cible B — pastille d'étape courante sur /mesurer ─────────────────────────────────────────────
// L'étape 1 est COURANTE au chargement (`step()` = 1) → `.mesurer__step--current` rendu sans aucune
// interaction ni carte (on évite tout flake Leaflet/geoman — L-017/L-019). La pastille `-step-num`
// est `aria-hidden` (décor numérique) → on la cible par classe, pas par rôle.

for (const theme of themes) {
  test(`pastille d'étape courante lisible (≥ 4.5:1) — ${theme.libelle}`, async ({ page }) => {
    await forceTheme(page, theme.id);
    await page.goto('/mesurer');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // Étape 1 courante au chargement → pastille rendue (positif).
    const num = page.locator('.mesurer__step--current .mesurer__step-num');
    await expect(num).toBeVisible();
    await expect(num).toHaveText(/1/);

    const ratio = await measuredContrast(num);
    expect(
      ratio,
      `Contraste de la pastille d'étape courante (${theme.libelle}) : ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
}
