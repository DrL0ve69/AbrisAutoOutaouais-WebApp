import { test, expect } from '@playwright/test';

// ── e2e : lien profond /auth?vue=inscription ──────────────────────────────────────────────
//
// La fusion des boutons navbar (un seul « Connexion ») a retiré le bouton « S'inscrire ». Le
// formulaire d'inscription reste atteignable (a) via la bascule in-page, (b) via le lien profond
// `/auth?vue=inscription`. Ce spec verrouille (b) : c'est le correctif du bug « S'inscrire →
// connexion » — sans garde CI, un changement futur de la vue initiale passerait inaperçu (L-005).

test.describe('/auth — lien profond d’inscription', () => {
  test('?vue=inscription ouvre directement le formulaire d’inscription (pas la connexion)', async ({
    page,
  }) => {
    await page.goto('/auth?vue=inscription');

    // POSITIF : le formulaire d'inscription est rendu d'emblée (titre « Créer un compte »).
    await expect(page.getByRole('heading', { name: /créer un compte/i })).toBeVisible();
    // Champ propre à l'inscription présent (désambiguïse vs la connexion).
    await expect(page.getByLabel(/nom d'utilisateur/i)).toBeVisible();

    // NÉGATIF (doublé d'un positif, L-002) : le titre de connexion n'est PAS affiché.
    await expect(page.getByRole('heading', { name: /^connexion$/i })).toHaveCount(0);
  });

  test('/auth (sans paramètre) ouvre la connexion par défaut', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: /^connexion$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /créer un compte/i })).toHaveCount(0);
  });
});
