import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── Données simulées (mock) ────────────────────────────────────────────────
// On simule l'API pour que l'interface ait du contenu SANS backend.
// page.route n'affecte que le navigateur (pas le rendu SSR initial) ; les
// composants gèrent les erreurs gracieusement et re-fetchent via le mock à
// l'hydratation. On attend donc toujours le contenu simulé avant axe.

const categories = [
  { id: 'c1', name: 'Abris simples', slug: 'abris-simples', productCount: 2 },
  { id: 'c2', name: 'Abris doubles', slug: 'abris-doubles', productCount: 1 },
  { id: 'c3', name: 'Accessoires', slug: 'accessoires', productCount: 3 },
];

const product = {
  id: 'p1',
  name: 'Abri simple Tempo Garage 10x20',
  slug: 'abri-simple',
  description: 'Abri d’auto une place robuste, idéal pour l’hiver québécois.',
  price: 599.99,
  rentalPrice: 49.99,
  stock: 12,
  isAvailable: true,
  categoryName: 'Abris simples',
  thumbnailUrl: null,
  imageUrls: [],
};

const productList = {
  items: [
    product,
    {
      id: 'p2',
      name: 'Abri double Tempo Car Shelter 18x20',
      slug: 'abri-double',
      description: 'Abri deux places pour protéger toute la famille.',
      price: 899.99,
      rentalPrice: 79.99,
      stock: 5,
      isAvailable: true,
      categoryName: 'Abris doubles',
      thumbnailUrl: null,
      imageUrls: [],
    },
    {
      id: 'p3',
      name: 'Abri compact Tempo 9x16',
      slug: 'abri-compact',
      description: 'Solution compacte pour petits espaces.',
      price: 449.99,
      rentalPrice: null,
      stock: 0,
      isAvailable: false,
      categoryName: 'Abris simples',
      thumbnailUrl: null,
      imageUrls: [],
    },
  ],
  totalCount: 3,
  pageNumber: 1,
  pageSize: 50,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

async function mockApi(page: Page): Promise<void> {
  // Catégories
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: categories }));
  // Produit unique par slug (ex. /products/abri-simple).
  // Enregistré AVANT le pattern de liste pour matcher en priorité.
  await page.route('**/api/v1/products/*', (route) => route.fulfill({ json: product }));
  // Liste paginée (ex. /products?page=1&pageSize=50)
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: productList }));
}

// Tags WCAG validés (A + AA, 2.0 et 2.1). color-contrast N'EST PAS désactivé.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('Accueil (/) — aucune violation WCAG AA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});

test('Boutique (/boutique) — aucune violation WCAG AA', async ({ page }) => {
  await page.goto('/boutique');
  await expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});

test('Détail produit (/boutique/abri-simple) — aucune violation WCAG AA', async ({ page }) => {
  await page.goto('/boutique/abri-simple');
  await expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});

test('Authentification (/auth) — aucune violation WCAG AA', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: /connexion/i }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});

test('Panier (/panier) — aucune violation WCAG AA', async ({ page }) => {
  await page.goto('/panier');
  // Panier vide par défaut (aucun article en session) — doit rester accessible.
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});

// ── Mode sombre ────────────────────────────────────────────────────────────
// Les passes ci-dessus s'exécutent en thème CLAIR (défaut). Plusieurs régressions
// de contraste ne se manifestaient QU'EN sombre (boutons `btn--secondary` du hero,
// bandeau CTA, lien « Administration ») car des tokens basculent en dark. On force
// donc le thème sombre via localStorage (lu par ThemeService au démarrage) et on
// relance axe sur les pages concernées — garde-fou contre ces régressions.
function forceDarkTheme(page: Page): Promise<void> {
  return page.addInitScript(() => {
    try {
      localStorage.setItem('abristempo-theme', 'dark');
    } catch {
      /* localStorage indisponible — ignoré */
    }
  });
}

test('Accueil (/) en mode SOMBRE — aucune violation WCAG AA', async ({ page }) => {
  await forceDarkTheme(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});

test('Boutique (/boutique) en mode SOMBRE — aucune violation WCAG AA', async ({ page }) => {
  await forceDarkTheme(page);
  await page.goto('/boutique');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      null,
      2,
    ),
  ).toEqual([]);
});
