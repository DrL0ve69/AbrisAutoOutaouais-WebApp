import { test, expect, type Page, type Request } from '@playwright/test';

// ── e2e : parcours INVITÉ (Épic F). Un visiteur NON connecté (aucun auth_token en localStorage)
// ajoute un produit au panier, atteint /panier/caisse (désormais OUVERTE — garde retiré, L-026),
// remplit ses coordonnées + une adresse de livraison, puis passe commande. On vérifie que le corps
// envoyé à POST /api/v1/orders porte un `guestContact` rempli ET la bonne `shippingAddress.province`.
//
// Deux cas : Ontario (province ≠ défaut « QC ») ET Québec — prouve que le backend (sans liste blanche
// de provinces, L-004) accepte les deux et que le formulaire transmet la valeur saisie.
//
// SSR + hydratation : on tape via le LOCATOR (`pressSequentially`, auto-focus + actionability), jamais
// `keyboard.type` (L-012). On capte le POST via `waitForRequest` (barrière, pas de `waitForTimeout`).
// L'API est simulée via page.route (aucun backend requis), comme checkout-order.spec.ts.

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

const GUEST = {
  firstName: 'Alex',
  lastName: 'Visiteur',
  email: 'alex.visiteur@exemple.com',
  phone: '819 555-0123',
};

interface AddressCase {
  readonly label: string;
  readonly civicNumber: string;
  readonly street: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
  readonly expectedPostal: string; // après normalisation « A1A 1A1 »
}

const ONTARIO: AddressCase = {
  label: 'Ontario',
  civicNumber: '111',
  street: 'rue Wellington',
  city: 'Ottawa',
  province: 'ON',
  postalCode: 'K1A0A6',
  expectedPostal: 'K1A 0A6',
};

const QUEBEC: AddressCase = {
  label: 'Québec',
  civicNumber: '222',
  street: 'boulevard Saint-Joseph',
  city: 'Gatineau',
  province: 'QC',
  postalCode: 'J8Y3X1',
  expectedPostal: 'J8Y 3X1',
};

async function mockApiAsGuest(page: Page): Promise<void> {
  // AUCUN auth_token / auth_user → l'app est en état « invité ».
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: PRODUCTS }));
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [] }));
  // L'autocomplétion d'adresse n'est pas exercée (on saisit la rue à la main) : on neutralise.
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );
}

/** Saisie via le locator (SSR-safe, L-012) : focus + clear + frappe séquentielle. */
async function fillBySelector(page: Page, selector: string, value: string): Promise<void> {
  const field = page.locator(selector);
  await field.click();
  await field.fill('');
  await field.pressSequentially(value);
}

async function runGuestCheckout(page: Page, addr: AddressCase): Promise<void> {
  await mockApiAsGuest(page);

  // Le panier est un signal en mémoire : on NE peut PAS goto('/panier/caisse') directement
  // (rechargement = panier vidé). On navigue dans le SPA (clics) pour le préserver.
  await page.goto('/boutique');
  await page.getByRole('button', { name: 'Ajouter au panier' }).first().click();
  await page.getByRole('link', { name: /panier/i }).first().click();
  await expect(page).toHaveURL(/\/panier$/);
  await page.getByRole('button', { name: /passer à la caisse/i }).click();
  await expect(page).toHaveURL(/\/panier\/caisse$/);

  // Invité atteint bien la caisse (pas de redirection /auth) : le bloc « coordonnées » est présent.
  await expect(page.getByRole('group', { name: /vos coordonnées/i })).toBeVisible();

  // « Livraison » → la section adresse s'affiche en formulaire DIRECT (aucune pastille pour l'invité).
  await page.getByRole('radio', { name: /livraison/i }).check();
  await expect(page.getByText('Adresse de mon profil')).toHaveCount(0);

  // Coordonnées invité (ids préfixés `co-guest-*` — uniques sur la page, L-013).
  await fillBySelector(page, '#co-guest-first', GUEST.firstName);
  await fillBySelector(page, '#co-guest-last', GUEST.lastName);
  await fillBySelector(page, '#co-guest-email', GUEST.email);
  await fillBySelector(page, '#co-guest-phone', GUEST.phone);

  // Adresse de livraison. EPIC 15 — champ UNIFIÉ « n° et rue » : on saisit « 111 rue Wellington »
  // dans `#co-address-line1` ; le split à l'envoi reproduira { civicNumber, street } côté serveur.
  await page.locator('#co-address-line1').fill(`${addr.civicNumber} ${addr.street}`);
  await page.locator('#co-city').fill(addr.city);
  await page.locator('#co-province').selectOption(addr.province); // province = <select> (codes 2 lettres)
  await page.locator('#co-postal').fill(addr.postalCode);

  // EPIC 7 : paiement par virement Interac — aucune carte. Capter le POST /orders (barrière) et le
  // confirmer (201) AVEC les instructions de virement.
  const orderRequest = page.waitForRequest(
    (req: Request) => req.url().endsWith('/api/v1/orders') && req.method() === 'POST',
  );
  await page.route('**/api/v1/orders', (route) =>
    route.fulfill({
      status: 201,
      json: {
        id: 'order-guest-e2e',
        payment: {
          reference: 'CMD-GUEST-0001',
          recipientEmail: 'paiements@abristempo.ca',
          amount: 599.99,
          instructions: 'Envoyez un virement Interac avec la référence indiquée.',
        },
      },
    }),
  );

  await page.getByRole('button', { name: /passer la commande/i }).click();

  const body = (await orderRequest).postDataJSON();

  // guestContact rempli (parcours invité).
  expect(body.guestContact).toBeTruthy();
  expect(body.guestContact.firstName).toBe(GUEST.firstName);
  expect(body.guestContact.lastName).toBe(GUEST.lastName);
  expect(body.guestContact.email).toBe(GUEST.email);
  expect(body.guestContact.phone).toBe(GUEST.phone);

  // Adresse + province saisies transmises telles quelles ; code postal normalisé.
  expect(body.deliveryType).toBe('Delivery');
  expect(body.shippingAddress.civicNumber).toBe(addr.civicNumber);
  expect(body.shippingAddress.street).toBe(addr.street);
  expect(body.shippingAddress.city).toBe(addr.city);
  expect(body.shippingAddress.province).toBe(addr.province);
  expect(body.shippingAddress.postalCode).toBe(addr.expectedPostal);
  expect(body.lines?.length).toBeGreaterThan(0);

  // Commande réussie : l'invité aboutit sur l'étape « virement Interac » (EPIC 7) — pas de
  // redirection automatique, et surtout PAS vers /auth. La référence du virement est affichée.
  await expect(
    page.getByRole('heading', { name: /réglez votre commande par virement interac/i }),
  ).toBeVisible();
  await expect(page.getByText('CMD-GUEST-0001')).toBeVisible();
  await expect(page).not.toHaveURL(/\/auth/);
}

test.describe('Caisse invité (/panier/caisse) — Épic F', () => {
  for (const addr of [ONTARIO, QUEBEC]) {
    test(`commande invité avec adresse ${addr.label} → POST /orders porte guestContact + province « ${addr.province} »`, async ({
      page,
    }) => {
      await runGuestCheckout(page, addr);
    });
  }
});
