import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : combobox d'autocomplétion d'adresse (ARIA APG), au CLAVIER seul.
//
// On mocke le proxy Places (suggest + lookup-postal-code) — aucun backend requis,
// comme a11y.spec.ts. Le parcours est entièrement clavier ; axe scanne la page
// ENTIÈRE (navbar incluse), sans exclusion (L-008 : pas de scope qui masque un bug).
// Page testée : /location, dont le champ « Rue » porte id="street".

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const SUGGESTIONS = [
  {
    label: '111 rue Wellington, Ottawa, ON',
    civicNumber: '111',
    street: 'rue Wellington',
    city: 'Ottawa',
    province: 'ON',
    postalCode: null,
    lat: null,
    lng: null,
  },
  {
    label: '222 rue Bank, Ottawa, ON',
    civicNumber: '222',
    street: 'rue Bank',
    city: 'Ottawa',
    province: 'ON',
    postalCode: null,
    lat: null,
    lng: null,
  },
];

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

/** Mocke les routes Places. `postalCode` = code retourné par le lookup (null = non résolu). */
async function mockPlaces(page: Page, postalCode: string | null): Promise<void> {
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: RENTABLE_PRODUCTS }));
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: SUGGESTIONS }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode } }),
  );
}

async function gotoLocation(page: Page): Promise<void> {
  await page.goto('/location');
  await expect(page.locator('#street')).toBeVisible();
}

test('frappe → la listbox s’ouvre et le compteur est annoncé', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await combo.focus();
  await page.keyboard.type('rue Well');

  // Listbox ouverte avec 2 options.
  await expect(combo).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option')).toHaveCount(2);

  // Compteur ANCRÉ PAR TEXTE (L-010 : un role="status" global existe dans app.html).
  await expect(
    page.getByRole('status').filter({ hasText: /adresse\(s\) trouvée\(s\)/i }),
  ).toBeVisible();
});

test('↓↓ déplace aria-activedescendant le long des options', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await combo.focus();
  await page.keyboard.type('rue Well');
  await expect(page.getByRole('option')).toHaveCount(2);

  await page.keyboard.press('ArrowDown');
  await expect(combo).toHaveAttribute('aria-activedescendant', 'street-option-0');
  await page.keyboard.press('ArrowDown');
  await expect(combo).toHaveAttribute('aria-activedescendant', 'street-option-1');
});

test('Entrée remplit les champs d’adresse et le code postal (éditable)', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await combo.focus();
  await page.keyboard.type('rue Well');
  await expect(page.getByRole('option')).toHaveCount(2);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // civic/rue/ville/province patchés depuis la suggestion.
  await expect(page.locator('#civicNumber')).toHaveValue('111');
  await expect(combo).toHaveValue('rue Wellington');
  await expect(page.locator('#city')).toHaveValue('Ottawa');
  await expect(page.locator('#province')).toHaveValue('ON');

  // Code postal résolu, normalisé, ET le champ reste éditable (non disabled/readonly).
  await expect(page.locator('#postalCode')).toHaveValue('K1A 0A6');
  await expect(page.locator('#postalCode')).toBeEditable();

  // Annonce du remplissage auto (scopée, par texte).
  await expect(
    page.getByRole('status').filter({ hasText: /code postal rempli automatiquement/i }),
  ).toBeVisible();

  // Le focus reste sur l'input (L-006) — la liste est fermée.
  await expect(combo).toBeFocused();
  await expect(combo).toHaveAttribute('aria-expanded', 'false');
});

test('Échap ferme la liste et garde le focus sur l’input', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await combo.focus();
  await page.keyboard.type('rue Well');
  await expect(page.getByRole('option')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(combo).toHaveAttribute('aria-expanded', 'false');
  await expect(combo).toBeFocused();
});

test('lookup null → le code postal n’est pas patché et rien n’est annoncé', async ({ page }) => {
  await mockPlaces(page, null); // le proxy ne résout aucun code postal
  await gotoLocation(page);

  const combo = page.locator('#street');
  await combo.focus();
  await page.keyboard.type('rue Well');
  await expect(page.getByRole('option')).toHaveCount(2);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.locator('#city')).toHaveValue('Ottawa');
  // Aucun code postal patché.
  await expect(page.locator('#postalCode')).toHaveValue('');
  // Aucune annonce de remplissage auto.
  await expect(
    page.getByRole('status').filter({ hasText: /code postal rempli automatiquement/i }),
  ).toHaveCount(0);
});

test('aucune violation axe (page entière, listbox ouverte)', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await combo.focus();
  await page.keyboard.type('rue Well');
  await expect(page.getByRole('option')).toHaveCount(2);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});
