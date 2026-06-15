import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// ── e2e : parcours premier utilisateur (Épic E) ──────────────────────────────
//
// E1 — après l'inscription, l'utilisateur est redirigé vers son profil
//      (/mon-compte/profil), pas vers la connexion. Verrou de régression (L-005) :
//      `submitRegister` navigue déjà vers le profil ; sans garde CI, un changement
//      futur de la cible passerait inaperçu.
//
// E2 — à la première connexion (adresse de profil VIDE), une alerte NON bloquante
//      « ajoutez votre adresse » s'affiche dans la page profil. « J'ai compris »
//      la ferme, mémorise le rejet (localStorage), renvoie le focus vers une cible
//      stable, et l'alerte ne revient pas après rechargement. Une adresse déjà
//      enregistrée → aucune alerte.
//
// L'API est simulée via page.route (aucun backend requis). Le status est ancré PAR
// TEXTE (L-010 : des role="status" globaux existent dans app.html).

const USER_ID = '11111111-1111-1111-1111-111111111111';

const AUTH_RESPONSE = {
  token: 'e2e.fake.jwt',
  userId: USER_ID,
  email: 'nouveau@test.com',
  username: 'nouveau',
  firstName: 'Nadia',
  lastName: 'Nouvelle',
  fullName: 'Nadia Nouvelle',
  roles: ['Customer'],
  avatar: null,
};

const SAVED_ADDRESS = {
  civicNumber: '111',
  street: 'rue Wellington',
  apartment: '4B',
  city: 'Ottawa',
  province: 'ON',
  postalCode: 'K1A 0A6',
  country: 'Canada',
};

/** Profil renvoyé par GET /auth/me, avec ou sans adresse de livraison. */
function profile(address: typeof SAVED_ADDRESS | null) {
  return {
    id: USER_ID,
    email: AUTH_RESPONSE.email,
    username: AUTH_RESPONSE.username,
    firstName: AUTH_RESPONSE.firstName,
    lastName: AUTH_RESPONSE.lastName,
    phoneNumber: null,
    avatar: null,
    preferredLanguage: 'fr',
    defaultDeliveryAddress: address,
    createdAt: '2026-01-01T00:00:00Z',
    roles: ['Customer'],
  };
}

const HINT_TEXT = /ajoutez votre adresse de livraison/i;

/**
 * Ouvre /mon-compte/profil via une navigation INTERNE au SPA (pas `page.goto`).
 *
 * `/mon-compte` est derrière `authGuard`. En SSR (l'app a @angular/ssr, servie même
 * en dev), un `page.goto('/mon-compte/profil')` rend d'abord côté serveur, où
 * `localStorage` n'existe pas → `isAuthenticated()` est faux → le guard redirige.
 * On charge donc l'accueil (l'app s'hydrate et lit la session depuis localStorage),
 * puis on entre dans le profil par le menu utilisateur, où le guard CLIENT voit bien
 * la session (même contrainte d'accès authentifié que L-026/checkout).
 */
async function gotoProfileViaSpa(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /menu de nadia nouvelle/i }).click();
  await page.getByRole('menuitem', { name: /mon profil/i }).click();
  await expect(page).toHaveURL(/\/mon-compte\/profil/);
  await expect(page.getByRole('tab', { name: /adresse de livraison/i })).toBeVisible();
}

/** Pose une session authentifiée (sans passer par le formulaire) + stub /auth/me. */
async function signIn(page: Page, address: typeof SAVED_ADDRESS | null): Promise<void> {
  await page.addInitScript(
    (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user);
    },
    {
      token: AUTH_RESPONSE.token,
      user: JSON.stringify({
        id: AUTH_RESPONSE.userId,
        email: AUTH_RESPONSE.email,
        username: AUTH_RESPONSE.username,
        firstName: AUTH_RESPONSE.firstName,
        lastName: AUTH_RESPONSE.lastName,
        roles: AUTH_RESPONSE.roles,
        avatar: null,
      }),
    },
  );
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: profile(address) }));
}

test.describe('Épic E — parcours premier utilisateur', () => {
  test('E1 — après l’inscription, redirection vers /mon-compte/profil (pas la connexion)', async ({
    page,
  }) => {
    // Disponibilité toujours OK (les validateurs async ne bloquent pas).
    await page.route('**/api/v1/auth/availability*', (route) =>
      route.fulfill({ json: { usernameAvailable: true, emailAvailable: true } }),
    );
    // L'inscription réussit → AuthResponse (la session est posée par le service).
    await page.route('**/api/v1/auth/register', (route) =>
      route.fulfill({ status: 201, json: AUTH_RESPONSE }),
    );
    // Le profil chargé après redirection : sans adresse (cohérent E2, mais E1 n'asserte que l'URL).
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: profile(null) }));

    await page.goto('/auth?vue=inscription');
    await expect(page.getByRole('heading', { name: /créer un compte/i })).toBeVisible();

    // SSR + hydratation : tant qu'Angular n'a pas (re)câblé les `(input)` des contrôles
    // réactifs, une valeur posée par `fill` n'est PAS captée par le formulaire (les
    // 1ᵉˢ champs remplis se vidaient → « Le prénom/nom est requis » au submit, famille
    // L-012). On remplit donc d'ABORD courriel + nom d'utilisateur : leurs validateurs
    // ASYNCHRONES (vérification de disponibilité, H5) ne se déclenchent qu'une fois le
    // contrôle réactif câblé, donc les confirmations « disponible » servent de BARRIÈRE
    // d'hydratation prouvée. Après elles, les `fill` suivants sont fiablement captés.
    // On rejoue le remplissage jusqu'à ce que le contrôle réactif soit câblé : tant que
    // l'hydratation n'a pas armé le flux async, la saisie ne déclenche aucune vérification
    // et « disponible » n'apparaît pas (flake observé en exécution parallèle). `toPass`
    // re-remplit (vide → re-saisit, ré-arme `distinctUntilChanged`) jusqu'au succès.
    await expect(async () => {
      await page.locator('#reg-email').fill('');
      await page.locator('#reg-email').fill('nouveau@test.com');
      await page.locator('#reg-username').fill('');
      await page.locator('#reg-username').fill('nouveau');
      await expect(page.getByText(/courriel disponible/i)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/nom d.utilisateur disponible/i)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 25000 });

    // Hydratation prouvée → les champs synchrones sont captés par le formulaire.
    await page.locator('#reg-first').fill('Nadia');
    await page.locator('#reg-last').fill('Nouvelle');
    await page.locator('#reg-pwd').fill('Sup3r!Pass');
    await page.locator('#reg-confirm').fill('Sup3r!Pass');

    // Soumettre et attendre l'appel register comme barrière réseau (anti-flake).
    const registerResponse = page.waitForResponse('**/api/v1/auth/register');
    await page.getByRole('button', { name: /créer mon compte/i }).click();
    await registerResponse;

    await expect(page).toHaveURL(/\/mon-compte\/profil/);
  });

  test('E2 — première connexion sans adresse : l’alerte s’affiche, se ferme et ne revient pas', async ({
    page,
  }) => {
    await signIn(page, null);
    await gotoProfileViaSpa(page);

    // Alerte présente la 1ʳᵉ fois — status ANCRÉ PAR TEXTE (L-010).
    const hint = page.getByRole('status').filter({ hasText: HINT_TEXT });
    await expect(hint).toBeVisible();

    // « J'ai compris » ferme l'alerte et renvoie le focus vers l'onglet Adresse (cible stable).
    await page.getByRole('button', { name: /j.ai compris/i }).click();
    await expect(hint).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /adresse de livraison/i })).toBeFocused();

    // Re-visite du profil après un rechargement complet (page.goto dans le helper) :
    // le rejet est persistant en localStorage → plus d'alerte.
    await gotoProfileViaSpa(page);
    await expect(page.getByRole('status').filter({ hasText: HINT_TEXT })).toHaveCount(0);
  });

  test('E2 — une adresse déjà enregistrée → aucune alerte', async ({ page }) => {
    await signIn(page, SAVED_ADDRESS);
    await gotoProfileViaSpa(page);

    // POSITIF : la page profil est rendue (gotoProfileViaSpa l'a déjà vérifié)…
    await expect(page.getByRole('tab', { name: /adresse de livraison/i })).toBeVisible();
    // …NÉGATIF : pas d'alerte d'adresse (L-002).
    await expect(page.getByRole('status').filter({ hasText: HINT_TEXT })).toHaveCount(0);
  });

  // Le contraste n'est PAS couvert par vitest (color-contrast désactivé, L-016) : la
  // bannière pose du texte (--color-text) sur le jeton --color-bg-muted, donc on valide
  // le contraste en e2e + axe DANS LES DEUX THÈMES (couleurs composées réelles).
  //
  // Scope volontairement RESTREINT à `.profile-hint` (l'élément introduit par E2) :
  // un scan pleine page révèle des violations color-contrast PRÉEXISTANTES sur les
  // onglets actifs du profil (texte blanc sur le rouge primaire #f87171 en thème
  // sombre, ~2.76:1) — hors périmètre d'Épic E, à traiter séparément (L-008 : ne pas
  // élargir un correctif à un bug non lié). On garde donc le scan POSITIF sur la
  // bannière, qui est ce que cette tâche ajoute.
  for (const theme of ['light', 'dark'] as const) {
    test(`E2 — bannière sans violation axe (thème ${theme})`, async ({ page }) => {
      await signIn(page, null);
      await page.addInitScript((t) => localStorage.setItem('abristempo-theme', t), theme);
      await gotoProfileViaSpa(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('status').filter({ hasText: HINT_TEXT })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include('.profile-hint')
        .withTags(WCAG_TAGS)
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
