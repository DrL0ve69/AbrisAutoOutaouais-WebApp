import { test, expect, type Page } from '@playwright/test';
import { forceTheme, measuredContrast } from './support/contrast';

// ── e2e : contraste TEXTE/FOND d'une surface colorée en thème SOMBRE (EPIC 12 partie 2) ──────────
//
// Cible dont le contraste échouait en SOMBRE et qu'axe ne voyait pas en vitest
// (`color-contrast` désactivé — L-016) :
//   • onglet actif `.profile-tab.is-active` (/mon-compte/profil) : `white` sur `--color-primary`
//        (rouge clair #f87171 en sombre) ≈ 2.76:1.
// On calcule le ratio WCAG DIRECTEMENT sur les couleurs composées réelles, dans les deux thèmes
// (garde non vacueuse — L-009/L-016 ; vit en e2e car le contraste n'est pas couvert en vitest — L-005).
//
// NOTE EPIC 10 : l'ancienne « Cible A » (badge « Ajusté serré » `.shelter-card__badge` des résultats
// /mesurer) a été RETIRÉE — la suggestion ne rend plus de badge tight-fit, donc cette cible n'existe
// plus (un test qui l'asserterait viserait un état inatteignable — L-008/L-026). Le contraste de
// l'étape résultats refondue est couvert par le balayage dual-thème de `mesurer.spec.ts`.

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

// ── Onglet actif `.profile-tab.is-active` (/mon-compte/profil, derrière authGuard) ───────────────
// /mon-compte/* est protégé : le SSR n'a pas le localStorage, donc on part de « / » (hydratée →
// authentifiée côté client) puis on navigue DANS le SPA (clics), idiome de rental-cancel.spec.ts.

const AUTH_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'client@test.com',
  username: 'client',
  firstName: 'Camille',
  lastName: 'Client',
  roles: ['Customer'],
  avatar: null,
};

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user);
    },
    { token: 'e2e.fake.jwt', user: JSON.stringify(AUTH_USER) },
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...AUTH_USER, defaultDeliveryAddress: null, preferredLanguage: 'fr' } }),
  );
}

async function gotoProfil(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /menu de/i }).click();
  await page.getByRole('menuitem', { name: /mon profil/i }).click();
  await expect(page).toHaveURL(/\/mon-compte\/profil$/);
}

for (const theme of themes) {
  test(`onglet actif du profil lisible (≥ 4.5:1) — ${theme.libelle}`, async ({ page }) => {
    await forceTheme(page, theme.id);
    await signIn(page);
    await gotoProfil(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // L'onglet « Informations » est actif par défaut → `.profile-tab.is-active` rendu (positif).
    const onglet = page.locator('.profile-tab.is-active');
    await expect(onglet).toBeVisible();
    await expect(onglet).toHaveText(/informations/i);

    const ratio = await measuredContrast(onglet);
    expect(
      ratio,
      `Contraste de l'onglet actif du profil (${theme.libelle}) : ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
}
