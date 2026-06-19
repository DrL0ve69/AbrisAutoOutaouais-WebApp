import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : commande d'un ABRI CONFIGURÉ (EPIC 9.4-g) ──────────────────────────────────────────────
//
// Parcours complet, en INVITÉ (aucun auth_token) : configurer un modèle paramétrique → « Ajouter au
// panier » → le panier affiche le nom du modèle + la longueur EN PIEDS + le prix → caisse invité →
// commande. On vérifie que le POST /api/v1/orders porte `shelterLines: [{ slug, lengthCm, quantity }]`
// SANS champ prix (le serveur recalcule — source unique L-004).
//
// SSR + hydratation : on tape via le LOCATOR (`pressSequentially`, jamais `keyboard.type` — L-012) et
// on franchit des BARRIÈRES RÉSEAU (`waitForResponse(/shelters\/.*\/price/)`, `waitForRequest(/orders)`),
// jamais `waitForTimeout`. Le panier étant un signal en MÉMOIRE, on navigue en SPA (clics) après
// l'ajout — un `goto` rechargerait et viderait le panier.
//
// Contraste : balayage axe DUAL-THÈME (clair + sombre, `color-contrast` inclus — NON couvert en
// vitest, L-016) du configurateur ET du panier.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Miroir de ShelterPriceCalculator.cs : base 349 $, 100 $/arche, min 122 cm, pas 122 cm.
const MODEL = {
  id: 'm1',
  slug: 'simple',
  name: 'Abri simple — Abris Tempo',
  categoryName: 'Abris simples',
  basePrice: 349,
  minLengthCm: 122,
  maxLengthCm: 1830,
  lengthStepCm: 122,
  pricePerArchCents: 10000,
  widthOptionsCm: [335, 366],
  clearHeightOptionsCm: [198, 244],
};

const GUEST = {
  firstName: 'Alex',
  lastName: 'Visiteur',
  email: 'alex.visiteur@exemple.com',
  phone: '819 555-0123',
};

async function mockApi(page: Page): Promise<void> {
  // Catalogue / catégories neutres (l'app charge en état invité ; aucun backend requis).
  await page.route('**/api/v1/products*', (route) =>
    route.fulfill({
      json: {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 100,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
  );
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );

  // Catalogue paramétrique (EPIC 9.2/9.3).
  await page.route('**/api/v1/shelters/simple/price*', (route) => {
    const url = new URL(route.request().url());
    const lengthCm = Number(url.searchParams.get('lengthCm'));
    const archCount = (lengthCm - MODEL.minLengthCm) / MODEL.lengthStepCm;
    const totalPrice = MODEL.basePrice + archCount * (MODEL.pricePerArchCents / 100);
    return route.fulfill({
      json: { modelId: MODEL.id, slug: MODEL.slug, lengthCm, archCount, totalPrice },
    });
  });
  await page.route('**/api/v1/shelters/simple', (route) => route.fulfill({ json: MODEL }));
}

/** Force le thème via localStorage AVANT navigation (clé lue par ThemeService). */
function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

/** Ouvre le configurateur et attend le 1er prix serveur (barrière réseau — L-012). */
async function gotoConfigurator(page: Page): Promise<void> {
  const firstPrice = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await page.goto('/boutique/configurer/simple');
  await expect(
    page.getByRole('heading', { level: 1, name: /configurez les dimensions/i }),
  ).toBeVisible();
  await firstPrice;
}

test('configurer un abri → ajouter au panier → caisse invité → POST /orders porte shelterLines', async ({
  page,
}) => {
  await mockApi(page);
  await gotoConfigurator(page);

  // Choisir une longueur de 366 cm (= min + 2 pas) → 549 $ ; barrière sur la requête `/price`.
  const number = page.locator('#configurator-length-number');
  const priceResp = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await number.fill('366');
  await priceResp;
  await expect(page.locator('.configurator__price-amount')).toContainText(/549,00/);

  // « Ajouter au panier » : actif (aria-disabled=false) une fois le prix confirmé.
  const addBtn = page.getByRole('button', { name: /ajouter au panier/i });
  await expect(addBtn).toHaveAttribute('aria-disabled', 'false');
  await addBtn.click();

  // Navigation SPA vers le panier (clic navbar — pas de goto qui viderait le panier en mémoire).
  await page.getByRole('link', { name: /^Panier/ }).first().click();
  await expect(page).toHaveURL(/\/panier$/);

  // Le panier affiche le modèle + la longueur EN PIEDS (366 cm → « 12 pi ») + le prix.
  const shelterList = page.getByRole('list', { name: /abris configurés/i });
  await expect(shelterList).toContainText(MODEL.name);
  await expect(shelterList).toContainText(/12 pi/);
  await expect(shelterList).toContainText(/549,00/);

  // Passer à la caisse (invité — route ouverte, L-026).
  await page.getByRole('button', { name: /passer à la caisse/i }).click();
  await expect(page).toHaveURL(/\/panier\/caisse$/);
  await expect(page.getByRole('group', { name: /vos coordonnées/i })).toBeVisible();

  // Coordonnées invité.
  await page.locator('#co-guest-first').fill(GUEST.firstName);
  await page.locator('#co-guest-last').fill(GUEST.lastName);
  await page.locator('#co-guest-email').fill(GUEST.email);
  await page.locator('#co-guest-phone').fill(GUEST.phone);

  // Réception « Cueillette » (Pickup) → aucune adresse requise ; on garde le parcours minimal.
  // Carte de paiement (démo) valide.
  await page.locator('#co-card-name').fill(`${GUEST.firstName} ${GUEST.lastName}`);
  await page.locator('#co-card-number').fill('4242424242424242');
  await page.locator('#co-expiry').fill('12/29');
  await page.locator('#co-cvc').fill('123');

  // Capter le POST /orders (barrière) et le confirmer (201).
  const orderRequest = page.waitForRequest(
    (req: Request) => req.url().endsWith('/api/v1/orders') && req.method() === 'POST',
  );
  await page.route('**/api/v1/orders', (route) =>
    route.fulfill({ status: 201, json: { id: 'order-shelter-e2e' } }),
  );
  await page.getByRole('button', { name: /payer/i }).click();

  const body = (await orderRequest).postDataJSON();

  // shelterLines transmis SANS prix (le serveur recalcule — L-004).
  expect(Array.isArray(body.shelterLines)).toBe(true);
  expect(body.shelterLines).toHaveLength(1);
  expect(body.shelterLines[0]).toEqual({ slug: 'simple', lengthCm: 366, quantity: 1 });
  expect(body.shelterLines[0]).not.toHaveProperty('price');
  expect(body.shelterLines[0]).not.toHaveProperty('totalPrice');
  // Parcours invité : guestContact rempli.
  expect(body.guestContact?.email).toBe(GUEST.email);

  // Commande réussie : l'invité est renvoyé à l'accueil (« mes commandes » est auth-gardé).
  await expect(page).toHaveURL(/\/$/);
  await expect(page).not.toHaveURL(/\/auth/);
});

for (const theme of ['light', 'dark'] as const) {
  test(`aucune violation axe (contraste inclus) du configurateur + panier — thème ${theme}`, async ({
    page,
  }) => {
    await forceTheme(page, theme);
    await mockApi(page);
    await gotoConfigurator(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // 1) Configurateur (avec le bouton d'ajout actif).
    await expect(page.getByRole('button', { name: /ajouter au panier/i })).toBeVisible();
    let results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);

    // 2) Panier avec un abri configuré dedans (surface couleur réelle présente).
    await page.getByRole('button', { name: /ajouter au panier/i }).click();
    await page.getByRole('link', { name: /^Panier/ }).first().click();
    await expect(page).toHaveURL(/\/panier$/);
    await expect(page.getByRole('list', { name: /abris configurés/i })).toContainText(MODEL.name);

    results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
}
