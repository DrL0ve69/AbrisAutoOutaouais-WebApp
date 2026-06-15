import { test, expect, type Page } from '@playwright/test';

// ── e2e : l'adresse de livraison enregistrée pré-remplit automatiquement les
// formulaires de location et d'installation (et de caisse, même mécanisme).
//
// On simule un utilisateur connecté possédant une adresse par défaut, puis on
// vérifie dans un VRAI navigateur que les champs d'adresse sont pré-remplis.
// L'API est simulée via page.route (aucun backend requis) — comme a11y.spec.ts.
// On utilise une adresse en ONTARIO pour prouver que même la province (dont la
// valeur par défaut du formulaire est « QC ») est bien remplie depuis le profil.

const SAVED_ADDRESS = {
  civicNumber: '111',
  street: 'rue Wellington',
  apartment: '4B',
  city: 'Ottawa',
  province: 'ON', // ≠ défaut « QC » du formulaire
  postalCode: 'K1A 0A6',
  country: 'Canada',
};

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

// Données minimales pour que les pages se chargent sans erreur réseau.
const RENTABLE_PRODUCTS = {
  items: [
    {
      id: 'p1',
      name: 'Abri simple Tempo 10x20',
      slug: 'abri-simple',
      description: 'Abri robuste.',
      price: 599.99,
      rentalPrice: 49.99, // != null → louable, donc la liste n'est pas vide
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

async function signInWithSavedAddress(page: Page): Promise<void> {
  // Injecte la session AVANT le bootstrap : AuthService lit le token au démarrage,
  // donc ProfileService.ensureLoaded() se déclenche et charge /auth/me.
  await page.addInitScript((data) => {
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', data.user);
  }, { token: 'e2e.fake.jwt', user: JSON.stringify(AUTH_USER) });

  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: SLOTS }),
  );
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: RENTABLE_PRODUCTS }));
}

async function expectAddressPrefilled(page: Page): Promise<void> {
  // D6 — l'utilisateur connecté voit d'abord la PASTILLE « Adresse de mon profil » ; le formulaire
  // n'apparaît qu'après « Utiliser une autre adresse ». On bascule donc avant d'asserter les champs.
  // Une fois révélé, le formulaire est pré-rempli depuis le profil (point de départ éditable),
  // toHaveValue ré-essayant jusqu'au timeout (autofill asynchrone). Le numéro civique et la rue
  // sont des champs distincts (C1 — split de l'adresse).
  await expect(page.getByText('Adresse de mon profil')).toBeVisible();
  await page.getByRole('button', { name: /utiliser une autre adresse/i }).click();

  await expect(page.locator('#civicNumber')).toHaveValue(SAVED_ADDRESS.civicNumber);
  await expect(page.locator('#street')).toHaveValue(SAVED_ADDRESS.street);
  await expect(page.locator('#apartment')).toHaveValue(SAVED_ADDRESS.apartment);
  await expect(page.locator('#city')).toHaveValue(SAVED_ADDRESS.city);
  await expect(page.locator('#province')).toHaveValue(SAVED_ADDRESS.province);
  await expect(page.locator('#postalCode')).toHaveValue(SAVED_ADDRESS.postalCode);
}

test.beforeEach(async ({ page }) => {
  await signInWithSavedAddress(page);
});

test('Location (/location) — pré-remplit automatiquement l’adresse enregistrée', async ({
  page,
}) => {
  await page.goto('/location');
  await expectAddressPrefilled(page);
});

test('Installation (/installation) — pré-remplit automatiquement l’adresse enregistrée', async ({
  page,
}) => {
  await page.goto('/installation');
  await expectAddressPrefilled(page);
});
