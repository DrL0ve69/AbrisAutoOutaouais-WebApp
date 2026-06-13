import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : réinitialisation du mot de passe de bout en bout (API simulée) ──
// 1. Demande de lien : /auth/reset → POST forgot-password (202) → confirmation
//    neutre (anti-énumération) annoncée en aria-live.
// 2. Réinitialisation : /auth/reset?email&token → POST reset-password (204) →
//    état de succès avec lien vers /auth ; jeton invalide → 400 → erreur.
// L'API est simulée via page.route, comme a11y.spec.ts / address-autofill.spec.ts.

const EMAIL = 'client@test.com';
// Jeton réaliste : contient des caractères échappés en URL (+, /, =) — la page
// doit transmettre au backend la valeur DÉCODÉE par le routeur Angular.
const RAW_TOKEN = 'CfDJ8+abc/def==';
const RESET_URL = `/auth/reset?email=${encodeURIComponent(EMAIL)}&token=${encodeURIComponent(RAW_TOKEN)}`;

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
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

async function expectAxeClean(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
}

for (const theme of themes) {
  test(`Demande de lien — confirmation neutre annoncée (${theme.libelle})`, async ({ page }) => {
    await forceTheme(page, theme.id);
    await page.route('**/api/v1/auth/forgot-password', (route) =>
      route.fulfill({ status: 202, body: '' }),
    );

    await page.goto('/auth/reset');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    await expect(
      page.getByRole('heading', { level: 1, name: /réinitialiser le mot de passe/i }),
    ).toBeVisible();

    await page.locator('#reset-email').fill(EMAIL);
    await page.getByRole('button', { name: /envoyer le lien/i }).click();

    // Confirmation neutre (role=status, aria-live polite) — le formulaire disparaît.
    // NB : la page porte aussi une région status globale (annonce de bascule de
    // langue, vide ici) → on cible la confirmation par son texte pour rester
    // sans ambiguïté (mode strict Playwright).
    const confirm = page.getByRole('status').filter({ hasText: /si un compte correspond/i });
    await expect(confirm).toContainText(/si un compte correspond/i);
    await expect(page.locator('#reset-email')).toHaveCount(0);

    await expectAxeClean(page);
  });

  test(`Réinitialisation — succès puis lien vers la connexion (${theme.libelle})`, async ({
    page,
  }) => {
    await forceTheme(page, theme.id);
    let posted: Record<string, unknown> | undefined;
    await page.route('**/api/v1/auth/reset-password', (route) => {
      posted = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto(RESET_URL);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    await expect(
      page.getByRole('heading', { level: 1, name: /choisir un nouveau mot de passe/i }),
    ).toBeVisible();

    await page.locator('#reset-new-password').fill('Nouveau@123');
    await page.locator('#reset-confirm-password').fill('Nouveau@123');
    await page.getByRole('button', { name: /réinitialiser le mot de passe/i }).click();

    await expect(
      page.getByRole('heading', { level: 2, name: /mot de passe réinitialisé/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /se connecter/i })).toBeVisible();

    // Le jeton transmis au backend est la valeur décodée du paramètre d'URL.
    expect(posted).toMatchObject({
      email: EMAIL,
      token: RAW_TOKEN,
      newPassword: 'Nouveau@123',
      confirmPassword: 'Nouveau@123',
    });

    await expectAxeClean(page);
  });
}

test('Réinitialisation — jeton invalide → erreur annoncée, formulaire conservé', async ({
  page,
}) => {
  const serverMessage = 'Le lien de réinitialisation est invalide ou expiré.';
  await forceTheme(page, 'light');
  await page.route('**/api/v1/auth/reset-password', (route) =>
    route.fulfill({ status: 400, json: { error: serverMessage } }),
  );

  await page.goto(RESET_URL);
  // Attendre l'hydratation AVANT de remplir : data-theme est posé par
  // ThemeService au bootstrap client — remplir le DOM SSR avant ce point
  // perd les valeurs (le formulaire réactif n'a pas encore d'écouteurs).
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#reset-new-password').fill('Nouveau@123');
  await page.locator('#reset-confirm-password').fill('Nouveau@123');
  await page.getByRole('button', { name: /réinitialiser le mot de passe/i }).click();

  // Erreur annoncée (role=alert) et formulaire toujours présent pour réessayer.
  await expect(page.getByRole('alert')).toContainText(serverMessage);
  await expect(
    page.getByRole('button', { name: /réinitialiser le mot de passe/i }),
  ).toBeVisible();

  await expectAxeClean(page);
});

test('La page de connexion mène à la réinitialisation (« Mot de passe oublié ? »)', async ({
  page,
}) => {
  await forceTheme(page, 'light');
  await page.goto('/auth');
  // Hydratation avant le clic (voir commentaire du test précédent).
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('link', { name: /mot de passe oublié/i }).click();

  await expect(page).toHaveURL(/\/auth\/reset$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /réinitialiser le mot de passe/i }),
  ).toBeVisible();
});
