import { test, expect, type Page, type Request } from '@playwright/test';

// ── e2e : un client connecté dont l'adresse par défaut est en ONTARIO peut passer
// une commande « Livraison » à la caisse — et le corps envoyé à POST /api/v1/orders
// porte bien « province: ON » et le code postal avec espace « K1A 0A6 ».
//
// Ferme le trou de couverture identifié : l'autofill d'adresse était testé pour
// /location et /installation, mais JAMAIS pour /panier/caisse, et aucun test ne
// passait réellement une commande. Une province ≠ « QC » (défaut du formulaire)
// prouve que l'autofill remplit la province et que le backend l'accepte (pas de
// liste blanche de provinces — voir leçons L-002 et L-004).
//
// L'API est simulée via page.route (aucun backend requis), comme a11y.spec.ts.

const SAVED_ADDRESS = {
  street: '111 rue Wellington',
  city: 'Ottawa',
  province: 'ON', // ≠ défaut « QC » du formulaire de caisse
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

const PRODUCTS = {
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

async function signInWithSavedAddress(page: Page): Promise<void> {
  await page.addInitScript(
    (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user);
    },
    { token: 'e2e.fake.jwt', user: JSON.stringify(AUTH_USER) },
  );

  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: PRODUCTS }));
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [] }));
  // La navigation post-commande charge « mes commandes » : on la stubbe pour éviter une erreur réseau.
  await page.route('**/api/v1/orders/mine', (route) => route.fulfill({ json: [] }));
}

test.beforeEach(async ({ page }) => {
  await signInWithSavedAddress(page);
});

test('Caisse (/panier/caisse) — commande Livraison avec adresse Ontario pré-remplie → POST /orders porte province « ON »', async ({
  page,
}) => {
  // Le panier est un signal en mémoire : on NE peut PAS faire page.goto('/panier/caisse')
  // (rechargement = panier vidé). On navigue donc dans le SPA (clics) pour le préserver.
  await page.goto('/boutique');
  await page.getByRole('button', { name: 'Ajouter au panier' }).first().click();

  // Aller au panier (lien du header), puis à la caisse (bouton « Passer la commande »).
  await page.getByRole('link', { name: /panier/i }).first().click();
  await expect(page).toHaveURL(/\/panier$/);
  await page.getByRole('button', { name: /passer à la caisse/i }).click();
  await expect(page).toHaveURL(/\/panier\/caisse$/);

  // Choisir « Livraison » → la section adresse s'affiche, pré-remplie depuis le profil.
  await page.getByRole('radio', { name: /livraison/i }).check();

  await expect(page.locator('#co-street')).toHaveValue(SAVED_ADDRESS.street);
  await expect(page.locator('#co-city')).toHaveValue(SAVED_ADDRESS.city);
  await expect(page.locator('#co-province')).toHaveValue(SAVED_ADDRESS.province);
  await expect(page.locator('#co-postal')).toHaveValue(SAVED_ADDRESS.postalCode);

  // Carte de paiement (démo) valide.
  await page.locator('#co-card-name').fill('Camille Client');
  await page.locator('#co-card-number').fill('4242424242424242');
  await page.locator('#co-expiry').fill('12/29');
  await page.locator('#co-cvc').fill('123');

  // Capter le POST /orders et le confirmer (201).
  const orderRequest = page.waitForRequest(
    (req: Request) => req.url().endsWith('/api/v1/orders') && req.method() === 'POST',
  );
  await page.route('**/api/v1/orders', (route) =>
    route.fulfill({ status: 201, json: { id: 'order-e2e-1' } }),
  );

  await page.getByRole('button', { name: /payer/i }).click();

  const body = (await orderRequest).postDataJSON();
  expect(body.deliveryType).toBe('Delivery');
  expect(body.shippingAddress.province).toBe('ON');
  expect(body.shippingAddress.postalCode).toBe('K1A 0A6');
  expect(body.shippingAddress.city).toBe('Ottawa');
  expect(body.lines?.length).toBeGreaterThan(0);

  // La commande réussie redirige vers « mes commandes ».
  await expect(page).toHaveURL(/\/mon-compte\/commandes$/);
});
