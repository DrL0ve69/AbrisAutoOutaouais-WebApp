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

// Créneaux d'installation simulés (deux créneaux le même jour) pour /installation.
const availableSlots = [
  { start: '2026-07-01T13:00:00', end: '2026-07-01T15:00:00' },
  { start: '2026-07-01T15:00:00', end: '2026-07-01T17:00:00' },
];

async function mockApi(page: Page): Promise<void> {
  // Catégories
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: categories }));
  // Créneaux disponibles pour la réservation d'installation.
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: availableSlots }),
  );
  // Produit unique par slug (ex. /products/abri-simple).
  // Enregistré AVANT le pattern de liste pour matcher en priorité.
  await page.route('**/api/v1/products/*', (route) => route.fulfill({ json: product }));
  // Liste paginée (ex. /products?page=1&pageSize=50)
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: productList }));
  // Suggestion d'abris (/mesurer étape résultats) — enregistrée APRÈS les patterns produits
  // pour gagner en priorité (Playwright privilégie la dernière route). L'étape 1 (Adresse)
  // ne l'appelle pas, mais on la mocke par sûreté pour éviter toute requête réelle.
  await page.route('**/api/v1/shelters/suggest*', (route) =>
    route.fulfill({ json: [] }),
  );
  // Proxy d'adresses (combobox de /mesurer étape 1) — aucune suggestion par défaut.
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: [] }));
}

// Tags WCAG validés (A + AA, 2.0 et 2.1). color-contrast N'EST PAS désactivé.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

// ── Balayage axe paramétré : routes × thèmes ───────────────────────────────
// Chaque route est vérifiée dans LES DEUX thèmes : plusieurs régressions de
// contraste ne se manifestaient QU'EN sombre (boutons `btn--secondary` du hero,
// bandeau CTA, lien « Administration ») car des tokens basculent en dark. On
// force le thème via localStorage (lu par ThemeService au démarrage), puis on
// confirme `data-theme` sur <html> AVANT de lancer axe — l'attente de l'attribut
// garantit aussi que l'hydratation a appliqué le thème.

const routes = [
  {
    nom: 'Accueil (/)',
    chemin: '/',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible(),
  },
  {
    nom: 'Boutique (/boutique)',
    chemin: '/boutique',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible(),
  },
  {
    nom: 'Détail produit (/boutique/abri-simple)',
    chemin: '/boutique/abri-simple',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible(),
  },
  {
    nom: 'Authentification (/auth)',
    chemin: '/auth',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { name: /connexion/i }).first()).toBeVisible(),
  },
  {
    nom: 'Panier (/panier)',
    // Panier vide par défaut (aucun article en session) — doit rester accessible.
    chemin: '/panier',
    pret: (page: Page) => expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(),
  },
  // Pages légales statiques (liées depuis le footer et /auth) — publiques,
  // aucun appel API nécessaire au-delà des mocks existants.
  {
    nom: 'Conditions d’utilisation (/conditions)',
    chemin: '/conditions',
    pret: (page: Page) =>
      expect(
        page.getByRole('heading', { level: 1, name: /conditions d'utilisation/i }),
      ).toBeVisible(),
  },
  {
    nom: 'Politique de confidentialité (/confidentialite)',
    chemin: '/confidentialite',
    pret: (page: Page) =>
      expect(
        page.getByRole('heading', { level: 1, name: /politique de confidentialité/i }),
      ).toBeVisible(),
  },
  {
    nom: 'Déclaration d’accessibilité (/accessibilite)',
    chemin: '/accessibilite',
    pret: (page: Page) =>
      expect(
        page.getByRole('heading', { level: 1, name: /déclaration d'accessibilité/i }),
      ).toBeVisible(),
  },
  // Pages porteuses de la FAQ accordéon (H-FAQ) — on attend l'apparition de la
  // section FAQ pour garantir que l'accordéon natif <details> est dans le scan axe.
  {
    nom: 'Installation (/installation) — avec FAQ',
    chemin: '/installation',
    pret: (page: Page) =>
      expect(
        page.getByRole('heading', { level: 2, name: /foire aux questions/i }),
      ).toBeVisible(),
  },
  {
    nom: 'Location (/location) — avec FAQ',
    chemin: '/location',
    pret: (page: Page) =>
      expect(
        page.getByRole('heading', { level: 2, name: /foire aux questions/i }),
      ).toBeVisible(),
  },
  // Outil « Trouver mon abri » (EPIC 13) — on atterrit sur l'étape 1 « Dimensionner », voie
  // « véhicules » par défaut : AUCUNE carte n'est rendue (la carte vit dans la voie « carte »,
  // derrière un `@defer`), donc AUCUNE exclusion axe ici — la page entière est scannée.
  {
    nom: 'Mesurer (/mesurer) — étape Dimensionner',
    chemin: '/mesurer',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { level: 2, name: /dimensionner/i })).toBeVisible(),
  },
] as const;

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

for (const theme of themes) {
  for (const route of routes) {
    test(`${route.nom} — aucune violation WCAG AA (${theme.libelle})`, async ({ page }) => {
      await forceTheme(page, theme.id);
      await page.goto(route.chemin);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
      await route.pret(page);

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
  }
}
