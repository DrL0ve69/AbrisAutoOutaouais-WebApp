import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : annulation d'une location depuis « Mes locations » (/mon-compte/locations).
// Vérifie dans un VRAI navigateur : rendu accessible (axe), ouverture d'une boîte de
// dialogue de confirmation (role="alertdialog") qui capture le focus, retour du focus
// sur le bouton déclencheur à la fermeture (WCAG 2.4.3), et l'appel réel
// POST /api/v1/rentals/{id}/cancel à la confirmation. API simulée via page.route.
//
// CONTRASTE (F2-C) : la promotion globale de `.btn--danger` (styles.scss) rend ROUGE pour la 1re
// fois le bouton « Confirmer l'annulation » de ce composant non-admin (template inline). Comme
// `color-contrast` est désactivé en vitest (L-016), un test e2e DUAL-THÈME (couleurs réelles
// composées) verrouille ce nouveau rendu rouge — voir le 2e test plus bas.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Force le thème AVANT le 1er rendu via localStorage (même mécanisme que `motion-a11y.spec.ts`).
 * `ThemeService` lit `abristempo-theme` à l'init et pose `html[data-theme]` ; on l'asserte avant axe.
 */
function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

const AUTH_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'client@test.com',
  username: 'client',
  firstName: 'Camille',
  lastName: 'Client',
  roles: ['Customer'],
  avatar: null,
};

const ACTIVE_RENTAL = {
  id: 'r1',
  productName: 'Abri simple Tempo',
  monthlyRate: 49,
  startDate: '2026-07-01',
  endDate: '2026-10-01',
  status: 'Active',
};

async function signInWithRental(page: Page): Promise<void> {
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
  await page.route('**/api/v1/rentals/mine', (route) => route.fulfill({ json: [ACTIVE_RENTAL] }));
}

/**
 * Navigue jusqu'à « Mes locations » DANS le SPA (clics) — /mon-compte/* est protégé par
 * authGuard et le SSR n'a pas le localStorage, donc on part d'une page publique hydratée.
 */
async function gotoMesLocations(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /menu de/i }).click();
  await page.getByRole('menuitem', { name: /mon profil/i }).click();
  await expect(page).toHaveURL(/\/mon-compte\/profil$/);
  await page.getByRole('link', { name: /mes locations/i }).click();
  await expect(page).toHaveURL(/\/mon-compte\/locations$/);
  await expect(page.getByText('Abri simple Tempo')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInWithRental(page);
});

test('Mes locations — annulation accessible (focus + POST /cancel)', async ({ page }) => {
  // /mon-compte/* est protégé par authGuard. En SSR le serveur n'a pas le localStorage,
  // donc un goto direct redirige vers /auth/login. On charge une page publique (qui
  // s'hydrate et devient authentifiée côté client), puis on navigue DANS le SPA (clics)
  // pour que le garde s'exécute côté navigateur où l'utilisateur est bien connecté.
  await page.goto('/');
  await page.getByRole('button', { name: /menu de/i }).click();
  await page.getByRole('menuitem', { name: /mon profil/i }).click();
  await expect(page).toHaveURL(/\/mon-compte\/profil$/);
  await page.getByRole('link', { name: /mes locations/i }).click();
  await expect(page).toHaveURL(/\/mon-compte\/locations$/);

  // La location s'affiche avec son bouton d'annulation.
  await expect(page.getByText('Abri simple Tempo')).toBeVisible();
  const annuler = page.getByRole('button', { name: /annuler la location/i });
  await expect(annuler).toBeVisible();

  // a11y de la PAGE ENTIÈRE — seul scénario e2e où la navbar est dans son état
  // authentifié (menu utilisateur rendu). L'ancienne exclusion « app-rentals »
  // contournait Bug-08 (aria-hidden-focus sur le menu fermé), corrigé par `inert`.
  let results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);

  // Ouvre la confirmation → alertdialog visible et focus capturé dans la boîte.
  await annuler.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  // a11y de la page entière avec le dialogue ouvert.
  results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);

  // Échap ferme et rend le focus au bouton déclencheur (WCAG 2.4.3).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(annuler).toBeFocused();

  // Ré-ouvre et confirme → POST /api/v1/rentals/r1/cancel envoyé.
  await annuler.click();
  const cancelRequest = page.waitForRequest(
    (req: Request) => /\/api\/v1\/rentals\/r1\/cancel$/.test(req.url()) && req.method() === 'POST',
  );
  await page.route('**/api/v1/rentals/*/cancel', (route) => route.fulfill({ status: 204, body: '' }));

  await page.getByRole('button', { name: /confirmer l.annulation/i }).click();
  await cancelRequest;

  // Le statut passe à « Annulée » et le bouton d'annulation disparaît.
  await expect(page.getByText('Annulée')).toBeVisible();
  await expect(page.getByRole('button', { name: /annuler la location/i })).toHaveCount(0);
});

// ── Contraste DUAL-THÈME du bouton « Confirmer l'annulation » (.btn--danger, F2-C). ──────────
// La promotion globale de `.btn--danger` rend ce bouton rouge (texte blanc sur #b91c1c ≈ 5.9:1)
// pour la 1re fois sur un composant non-admin. `color-contrast` étant désactivé en vitest (L-016),
// on le valide ICI sur les couleurs RÉELLES composées, dans les DEUX thèmes (clair + sombre — la
// couleur de marque est fixe, mais le fond du dialogue bascule par thème, d'où le double scan).
for (const theme of ['light', 'dark'] as const) {
  test(`Annulation — contraste color-contrast du bouton danger ouvert (thème ${theme})`, async ({
    page,
  }) => {
    await forceTheme(page, theme);
    await gotoMesLocations(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // Ouvre la boîte de confirmation → le bouton rouge .btn--danger est rendu et scannable.
    await page.getByRole('button', { name: /annuler la location/i }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const confirmer = page.getByRole('button', { name: /confirmer l.annulation/i });
    await expect(confirmer).toBeVisible();

    // Scan axe CIBLÉ color-contrast sur la page entière (couvre le bouton rouge ouvert, son
    // hover #991b1b restant ≥ 4.5:1, et le reste du dialogue/contenu). Inclut explicitement la
    // règle color-contrast (app réelle, styles globaux chargés — contrairement à vitest).
    const results = await new AxeBuilder({ page })
      .options({ runOnly: { type: 'rule', values: ['color-contrast'] } })
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2),
    ).toEqual([]);
  });
}
