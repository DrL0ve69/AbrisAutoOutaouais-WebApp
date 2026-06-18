import { test, expect, type Page } from '@playwright/test';
import { forceTheme, measuredContrast } from './support/contrast';

// ── e2e : contraste TEXTE/FOND de deux surfaces colorées en thème SOMBRE (EPIC 12 partie 2) ──────
//
// Deux cibles dont le contraste échouait en SOMBRE et qu'axe ne voyait pas en vitest
// (`color-contrast` désactivé — L-016) :
//   • A — badge « Ajusté serré » `.shelter-card__badge` (résultats /mesurer) : `#fff` sur
//        `--color-warning` (amber #fbbf24 en sombre) ≈ 1.66:1 (Bug-09, board.md/audit §5.11).
//   • B — onglet actif `.profile-tab.is-active` (/mon-compte/profil) : `white` sur `--color-primary`
//        (rouge clair #f87171 en sombre) ≈ 2.76:1.
// On calcule le ratio WCAG DIRECTEMENT sur les couleurs composées réelles, dans les deux thèmes
// (garde non vacueuse — L-009/L-016 ; vit en e2e car le contraste n'est pas couvert en vitest — L-005).

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

// ── Cible A — badge « Ajusté serré » dans les résultats /mesurer ────────────────────────────────
// On atteint l'étape résultats par le CALCULATEUR de véhicules (défaut, SSR-safe) — JAMAIS la carte
// (flake Leaflet/geoman — L-017/L-019). La suggestion mockée porte `isTightFit: true` → badge rendu.

const SHELTERS = [
  {
    id: 's1',
    name: 'Abri double Tempo 18x20',
    slug: 'abri-double',
    price: 899.99,
    rentalPrice: 79.99,
    categoryName: 'Abris doubles',
    imageUrl: null,
    widthCm: 320,
    lengthCm: 620,
    heightCm: 250,
    widthMarginCm: 10,
    lengthMarginCm: 20,
    isTightFit: true,
    brand: 'Abris Tempo',
    model: 'Tempo Duo 18x20',
  },
];

async function mockMesurerApi(page: Page): Promise<void> {
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );
  await page.route('**/api/v1/products/suggest-shelters*', (route) =>
    route.fulfill({ json: SHELTERS }),
  );
}

/** Complète l'adresse (sans suggestion → géocodage via `suggest`, barrière réseau — L-012). */
async function gotoResultsViaCalculator(page: Page): Promise<void> {
  await page.goto('/mesurer');
  await expect(page.getByRole('heading', { level: 2, name: /adresse/i })).toBeVisible();
  await page.getByLabel(/numéro civique/i).fill('123');
  await page.locator('#mesurer-rue').pressSequentially('123 rue Principale');
  await page.getByLabel(/ville/i).fill('Gatineau');
  const submit = page.getByRole('button', { name: /continuer vers la mesure/i });
  await Promise.all([page.waitForResponse((r) => /places\/suggest/.test(r.url())), submit.click()]);
  await expect(page.getByRole('heading', { level: 2, name: /mesure/i })).toBeVisible();

  // Calculateur (mode par défaut) : 1 berline → calcul → étape résultats avec abri « ajusté serré ».
  await page.getByLabel(/berline/i).fill('1');
  await page.getByRole('button', { name: /calculer le gabarit/i }).click();
  await expect(page.getByRole('heading', { level: 2, name: /résultats/i })).toBeVisible();
}

for (const theme of themes) {
  test(`badge « Ajusté serré » lisible (≥ 4.5:1) — ${theme.libelle}`, async ({ page }) => {
    await forceTheme(page, theme.id);
    await mockMesurerApi(page);
    await gotoResultsViaCalculator(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // Cible scopée par CLASSE (pas de getByRole nu — L-010). Le badge ne porte ni rôle ni texte
    // identifiant côté axe ; on le cible par sa classe et on vérifie qu'il est bien rendu (positif).
    const badge = page.locator('.shelter-card__badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/ajusté serré/i);

    const ratio = await measuredContrast(badge);
    expect(
      ratio,
      `Contraste du badge « Ajusté serré » (${theme.libelle}) : ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
}

// ── Cible B — onglet actif `.profile-tab.is-active` (/mon-compte/profil, derrière authGuard) ─────
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
