import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Force le thème via localStorage AVANT navigation (même mécanisme que motion-a11y / mesurer). */
function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

// ── e2e (D6) : utilisateur connecté ⇒ DEUX choix d'adresse (pastille profil OU « autre adresse »).
//
// Couvre les 4 écrans où une adresse est requise (caisse, location, installation, mesurer) :
//  - CONNECTÉ avec adresse de profil (en ONTARIO, ≠ défaut « QC » du formulaire — L-002) :
//    la PASTILLE « Adresse de mon profil » s'affiche par défaut, en lecture seule, avec l'adresse
//    FORMATÉE ; le formulaire structuré est masqué. Clic « Utiliser une autre adresse » → le
//    formulaire éditable apparaît, pré-rempli depuis le profil, et le bouton retour reçoit le focus.
//  - ANONYME (aucune adresse) : AUCUNE pastille, le formulaire d'adresse s'affiche directement
//    (frontière dure — parcours invité STRICTEMENT inchangé).
//
// L'API est simulée via page.route (aucun backend requis), comme a11y.spec.ts / checkout-order.spec.ts.

const SAVED_ADDRESS = {
  civicNumber: '111',
  street: 'rue Wellington',
  apartment: '4B',
  city: 'Ottawa',
  province: 'ON', // ≠ défaut « QC » des formulaires
  postalCode: 'K1A 0A6',
  country: 'Canada',
};

/** Ligne attendue dans la pastille (= formatAddressLine). */
const FORMATTED = '111 rue Wellington, app. 4B, Ottawa, ON K1A 0A6';

const PROFILE = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'client@test.com',
  username: 'client',
  firstName: 'Camille',
  lastName: 'Client',
  phoneNumber: null,
  avatar: null,
  preferredLanguage: 'fr',
  defaultDeliveryAddress: SAVED_ADDRESS,
  createdAt: '2026-01-01T00:00:00Z',
  roles: ['Customer'],
};

const AUTH_USER = {
  id: PROFILE.id,
  email: PROFILE.email,
  username: PROFILE.username,
  firstName: PROFILE.firstName,
  lastName: PROFILE.lastName,
  roles: ['Customer'],
  avatar: null,
};

const RENTABLE_PRODUCTS = {
  items: [
    {
      id: 'p1',
      name: 'Abri simple Tempo 10x20',
      slug: 'abri-simple',
      description: 'Abri robuste.',
      price: 599.99,
      rentalPrice: 49.99,
      stock: 12,
      isAvailable: true,
      categoryName: 'Abris simples',
      thumbnailUrl: null,
      imageUrls: [],
    },
  ],
  totalCount: 1,
  pageNumber: 1,
  pageSize: 100,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

const SLOTS = [{ start: '2026-07-01T13:00:00Z', end: '2026-07-01T15:00:00Z' }];

/** Routes communes (produits, créneaux, places) — sans session. */
async function mockCommonApi(page: Page): Promise<void> {
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: SLOTS }),
  );
  await page.route('**/api/v1/shelters/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: RENTABLE_PRODUCTS }));
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );
}

/** Connecte un utilisateur possédant une adresse de profil (avant bootstrap). */
async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user);
    },
    { token: 'e2e.fake.jwt', user: JSON.stringify(AUTH_USER) },
  );
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: PROFILE }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTÉ — la pastille s'affiche, bascule vers le formulaire éditable pré-rempli.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('connecté avec adresse de profil', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await mockCommonApi(page);
  });

  test('Location (/location) — pastille par défaut puis bascule vers formulaire pré-rempli + focus retour', async ({
    page,
  }) => {
    await page.goto('/location');

    // Pastille visible avec l'adresse formatée ; le formulaire est masqué.
    await expect(page.getByText('Adresse de mon profil')).toBeVisible();
    await expect(page.getByText(FORMATTED)).toBeVisible();
    await expect(page.locator('#street')).toHaveCount(0);

    // Bascule vers « autre adresse ».
    await page.getByRole('button', { name: /utiliser une autre adresse/i }).click();

    // Le formulaire est désormais visible et pré-rempli depuis le profil (point de départ éditable).
    await expect(page.locator('#street')).toBeVisible();
    await expect(page.locator('#civicNumber')).toHaveValue(SAVED_ADDRESS.civicNumber);
    await expect(page.locator('#street')).toHaveValue(SAVED_ADDRESS.street);
    await expect(page.locator('#city')).toHaveValue(SAVED_ADDRESS.city);
    await expect(page.locator('#province')).toHaveValue(SAVED_ADDRESS.province);

    // Le bouton retour reçoit le focus après le rendu (L-006).
    await expect(
      page.getByRole('button', { name: /utiliser l'adresse de mon profil/i }),
    ).toBeFocused();
  });

  test('Installation (/installation) — pastille par défaut puis bascule vers formulaire pré-rempli', async ({
    page,
  }) => {
    await page.goto('/installation');

    await expect(page.getByText('Adresse de mon profil')).toBeVisible();
    await expect(page.getByText(FORMATTED)).toBeVisible();
    await expect(page.locator('#street')).toHaveCount(0);

    await page.getByRole('button', { name: /utiliser une autre adresse/i }).click();

    await expect(page.locator('#street')).toBeVisible();
    await expect(page.locator('#province')).toHaveValue(SAVED_ADDRESS.province);
  });

  test('Mesurer (/mesurer) — pastille par défaut puis bascule vers formulaire pré-rempli', async ({
    page,
  }) => {
    await page.goto('/mesurer');

    // EPIC 13 : l'adresse vit DÉSORMAIS dans la voie « Mesurer sur la carte » de l'étape
    // « Dimensionner » (plus d'étape adresse préalable). On sélectionne d'abord la voie carte
    // pour révéler l'input adresse (L-037 : migrer la couverture, pas la supprimer).
    await page.getByRole('radio', { name: /mesurer sur la carte/i }).click();

    await expect(page.getByText('Adresse de mon profil')).toBeVisible();
    await expect(page.getByText(FORMATTED)).toBeVisible();
    await expect(page.locator('#mesurer-rue')).toHaveCount(0);

    await page.getByRole('button', { name: /utiliser une autre adresse/i }).click();
    await expect(page.locator('#mesurer-rue')).toBeVisible();
    await expect(page.locator('#mesurer-province')).toHaveValue(SAVED_ADDRESS.province);
  });

  test('Caisse (/panier/caisse) — pastille par défaut après choix « Livraison »', async ({
    page,
  }) => {
    // Le panier est un signal en mémoire : on navigue dans le SPA (pas de goto direct).
    await page.goto('/boutique');
    await page.getByRole('button', { name: 'Ajouter au panier' }).first().click();
    await page.getByRole('link', { name: /panier/i }).first().click();
    await page.getByRole('button', { name: /passer à la caisse/i }).click();
    await expect(page).toHaveURL(/\/panier\/caisse$/);

    // « Livraison » → la section adresse s'affiche : pastille profil par défaut.
    await page.getByRole('radio', { name: /livraison/i }).check();
    await expect(page.getByText('Adresse de mon profil')).toBeVisible();
    await expect(page.getByText(FORMATTED)).toBeVisible();
    await expect(page.locator('#co-street')).toHaveCount(0);

    // Bascule → formulaire éditable pré-rempli.
    await page.getByRole('button', { name: /utiliser une autre adresse/i }).click();
    await expect(page.locator('#co-province')).toHaveValue(SAVED_ADDRESS.province);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANONYME — frontière dure : aucune pastille, formulaire direct (non-régression).
// ─────────────────────────────────────────────────────────────────────────────

test.describe('anonyme (aucune adresse de profil)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCommonApi(page);
  });

  test('Location (/location) — formulaire direct, AUCUNE pastille', async ({ page }) => {
    await page.goto('/location');
    // Positif : le formulaire est rendu d'emblée.
    await expect(page.locator('#street')).toBeVisible();
    // Négatif : aucune pastille ni bouton de bascule.
    await expect(page.getByText('Adresse de mon profil')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /utiliser une autre adresse/i })).toHaveCount(0);
  });

  test('Installation (/installation) — formulaire direct, AUCUNE pastille', async ({ page }) => {
    await page.goto('/installation');
    await expect(page.locator('#street')).toBeVisible();
    await expect(page.getByText('Adresse de mon profil')).toHaveCount(0);
  });

  test('Mesurer (/mesurer) — formulaire direct, AUCUNE pastille', async ({ page }) => {
    await page.goto('/mesurer');
    // EPIC 13 : l'adresse vit dans la voie « Mesurer sur la carte » → on la sélectionne d'abord.
    await page.getByRole('radio', { name: /mesurer sur la carte/i }).click();
    await expect(page.locator('#mesurer-rue')).toBeVisible();
    await expect(page.getByText('Adresse de mon profil')).toHaveCount(0);
  });

  // NB : depuis l'Épic F, la caisse (/panier/caisse) est OUVERTE aux invités (garde retiré, L-026) :
  // un visiteur anonyme y atteint bien le formulaire d'adresse (aucune pastille, frontière dure). Ce
  // parcours invité bout-en-bout (contact + adresse → POST /orders) est couvert par checkout-guest.spec.ts.
  // Le parcours invité du formulaire direct est aussi couvert ici sur /location, /installation et /mesurer.
});

// ─────────────────────────────────────────────────────────────────────────────
// MESURER — en mode profil (voie carte), l'adresse profil est AUTO-géocodée et la carte se centre.
// ─────────────────────────────────────────────────────────────────────────────

test('Mesurer — mode profil (voie carte) : l’adresse profil est AUTO-géocodée et la carte CENTRÉE (capacité, L-019)', async ({
  page,
}) => {
  test.setTimeout(60000);
  await signIn(page);
  // `suggest` (réutilisé par `geocode`) renvoie des coordonnées CONNUES pour l'adresse profil.
  const GEO = { lat: 45.3201, lng: -75.8702 };
  await page.route('**/api/v1/bookings/available-slots*', (route) => route.fulfill({ json: SLOTS }));
  await page.route('**/api/v1/shelters/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: RENTABLE_PRODUCTS }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );
  await page.route('**/api/v1/places/suggest*', (route) =>
    route.fulfill({
      json: [
        {
          label: '111 rue Wellington, Ottawa, ON',
          civicNumber: '111',
          street: 'rue Wellington',
          city: 'Ottawa',
          province: 'ON',
          postalCode: null,
          lat: GEO.lat,
          lng: GEO.lng,
        },
      ],
    }),
  );

  await page.goto('/mesurer');
  // EPIC 13 : l'adresse vit dans la voie « Mesurer sur la carte ». On la sélectionne ; en mode
  // profil (D6/L-003), `MapVoieComponent` géocode AUTOMATIQUEMENT l'adresse profil (`/auth/me`) et
  // centre la carte dessus, sans action utilisateur. Barrière réseau sur `suggest` (L-012).
  await Promise.all([
    page.waitForResponse((r) => /places\/suggest/.test(r.url())),
    page.getByRole('radio', { name: /mesurer sur la carte/i }).click(),
  ]);
  await expect(page.getByText('Adresse de mon profil')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });

  // CAPACITÉ (L-019) : la carte est CENTRÉE sur l'adresse profil géocodée, pas sur le repli Gatineau.
  // Le centrage suit la résolution asynchrone du géocodage → on poll l'input `lat()` jusqu'à la valeur.
  await expect
    .poll(
      () =>
        page.locator('app-map-measure').evaluate((el) => {
          const cmp = (
            window as unknown as {
              ng: { getComponent(node: Element): { lat(): number | null } };
            }
          ).ng.getComponent(el);
          return cmp.lat();
        }),
      { timeout: 10000 },
    )
    .toBeCloseTo(GEO.lat, 4);

  const coords = await page.locator('app-map-measure').evaluate((el) => {
    const cmp = (
      window as unknown as {
        ng: { getComponent(node: Element): { lat(): number | null; lng(): number | null } };
      }
    ).ng.getComponent(el);
    return { lat: cmp.lat(), lng: cmp.lng() };
  });
  expect(coords.lat).toBeCloseTo(GEO.lat, 4);
  expect(coords.lng).toBeCloseTo(GEO.lng, 4);
  expect(coords.lat).not.toBeCloseTo(45.4765, 3);
});

// ── CONTRASTE de la PASTILLE (couleurs réelles, DUAL-THÈME) ─────────────────────────────────────
//
// La pastille `app-address-choice` introduit une carte (`--color-bg-muted`) + boutons : `color-contrast`
// est DÉSACTIVÉ en vitest (L-016), donc on valide le contraste ICI (app réelle, `WCAG_TAGS` ⇒ règle
// incluse) dans LES DEUX thèmes (motion-a11y §2). On scanne /location connecté, où la pastille est
// rendue par défaut.

for (const theme of ['light', 'dark'] as const) {
  test(`pastille connectée — zéro violation axe (contraste inclus) en thème ${theme}`, async ({
    page,
  }) => {
    await forceTheme(page, theme);
    await signIn(page);
    await mockCommonApi(page);

    await page.goto('/location');
    await expect(page.getByText('Adresse de mon profil')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // Pastille affichée (mode profil).
    const onPastille = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(onPastille.violations).toEqual([]);

    // Après bascule (mode « autre adresse » : bouton retour + formulaire éditable).
    await page.getByRole('button', { name: /utiliser une autre adresse/i }).click();
    await expect(page.locator('#street')).toBeVisible();
    const onForm = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(onForm.violations).toEqual([]);
  });
}
