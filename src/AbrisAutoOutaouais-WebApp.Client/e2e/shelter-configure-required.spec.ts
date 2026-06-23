import { test, expect, type Page } from '@playwright/test';

// ── e2e : garde « un abri ne peut JAMAIS aller au panier sans dimensions » (rework EPIC 9) ───────
//
// Plainte n°1 du propriétaire : l'achat d'un abri DOIT passer par l'overlay de configuration
// (dimensions obligatoires). Cette suite PROUVE qu'aucun chemin n'ajoute un abri au panier sans
// largeur/longueur/hauteur — depuis l'ACCUEIL (`/`, section vedette) ET depuis la BOUTIQUE
// (`/boutique`, vue catégorie ET vue « Tous »). À chaque fois la ligne de panier résultante porte
// Largeur/Longueur/Hauteur, jamais un simple prix unitaire « ajout direct ».
//
// Le bouton de la carte de modèle (`app-shelter-model-card`) OUVRE l'overlay (libellé « Configurer
// et ajouter au panier — <modèle> ») : il n'ajoute RIEN directement. Le seul ajout au panier vit
// dans l'overlay, et il porte les dimensions. On l'asserte au COMPORTEMENT (L-008) : pas de bouton
// « Ajouter au panier » dans la grille de cartes qui pousse un abri direct au panier.
//
// Le panier est un signal EN MÉMOIRE → on navigue en SPA (clic navbar Panier), jamais `goto` (qui
// rechargerait et viderait le panier).
//
// Mock en MIROIR du provider réel (L-011) : forme `ShelterModel*Dto` (camelCase .NET), slug PAR
// LARGEUR (`simple-11pi`, largeur unique 335 cm → « 11 pi »), `/price` calculé comme
// `ShelterPriceCalculator.cs` (couple absent de la grille → 422).

const CATEGORY = { id: 'cat-simples', name: 'Abris simples', slug: 'abris-simples', productCount: 1 };

// Grille de prix exacte (CENTS), une seule hauteur (198 cm). Prix = base + (longueur−min)/pas × 150 $.
function buildGrid(minLengthCm: number, maxLengthCm: number, stepCm: number, baseCents: number) {
  const grid: { lengthCm: number; clearHeightCm: number; priceCents: number }[] = [];
  for (let l = minLengthCm; l <= maxLengthCm; l += stepCm) {
    grid.push({ lengthCm: l, clearHeightCm: 198, priceCents: baseCents + ((l - minLengthCm) / stepCm) * 15000 });
  }
  return grid;
}

const MODEL = {
  id: 'm-simple-11pi',
  slug: 'simple-11pi',
  name: 'Abri simple 11 pi — Abris Tempo',
  categoryId: CATEGORY.id,
  categoryName: CATEGORY.name,
  basePrice: 1099,
  minLengthCm: 488,
  maxLengthCm: 1830,
  lengthStepCm: 122,
  priceGrid: buildGrid(488, 1830, 122, 109900),
  widthOptionsCm: [335], // « 11 pi »
  clearHeightOptionsCm: [198], // « 6 pi 6 po »
};

const SUMMARY = {
  id: MODEL.id,
  slug: MODEL.slug,
  name: MODEL.name,
  categoryName: MODEL.categoryName,
  basePrice: MODEL.basePrice,
  minLengthCm: MODEL.minLengthCm,
  maxLengthCm: MODEL.maxLengthCm,
  lengthStepCm: MODEL.lengthStepCm,
};

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [CATEGORY] }));
  // AUCUN produit fixe (les abris fixes ont été retirés ; les seuls produits seraient toiles/pièces).
  await page.route('**/api/v1/products*', (route) =>
    route.fulfill({
      json: {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 50,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    }),
  );
  await page.route('**/api/v1/shelters?*', (route) => route.fulfill({ json: [SUMMARY] }));
  await page.route('**/api/v1/shelters', (route) => route.fulfill({ json: [SUMMARY] }));
  await page.route(`**/api/v1/shelters/${MODEL.slug}`, (route) => route.fulfill({ json: MODEL }));
  await page.route(`**/api/v1/shelters/${MODEL.slug}/price*`, (route) => {
    const url = new URL(route.request().url());
    const lengthCm = Number(url.searchParams.get('lengthCm'));
    const clearHeightCm = Number(url.searchParams.get('clearHeightCm'));
    const entry = MODEL.priceGrid.find((e) => e.lengthCm === lengthCm && e.clearHeightCm === clearHeightCm);
    if (!entry) {
      return route.fulfill({ status: 422, json: { title: 'Combinaison non offerte' } });
    }
    return route.fulfill({
      json: { modelId: MODEL.id, slug: MODEL.slug, lengthCm, clearHeightCm, totalPrice: entry.priceCents / 100 },
    });
  });
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

/**
 * Configure un abri DANS l'overlay (choix de longueur « 24 pi », barrière sur `/price`) puis ajoute
 * au panier. L'overlay se referme tout seul après l'ajout. Le `trigger` est le bouton « Configurer »
 * de la carte qui a ouvert l'overlay.
 */
async function configureAndAdd(page: Page) {
  const firstPrice = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  const trigger = page.getByRole('button', { name: new RegExp(`Configurer.*${MODEL.name}`) }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: MODEL.name });
  await expect(dialog).toBeVisible();
  await firstPrice;

  // Choisir une longueur de 732 cm (= min + 2 pas) → « 24 pi » ; barrière sur la requête `/price`.
  const priceResp = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await dialog.locator('#configurator-length-select').selectOption({ label: '24 pi' });
  await priceResp;

  const addBtn = dialog.getByRole('button', { name: /ajouter au panier/i });
  await expect(addBtn).toHaveAttribute('aria-disabled', 'false');
  await addBtn.click();
  await expect(dialog).toBeHidden();
}

/** Navigue en SPA vers le panier (clic navbar — pas de goto qui viderait le panier en mémoire). */
async function gotoCartViaNavbar(page: Page) {
  await page.getByRole('link', { name: /^Panier/ }).first().click();
  await expect(page).toHaveURL(/\/panier$/);
}

/** Assert : la ligne d'abri du panier porte Largeur/Longueur/Hauteur (jamais un ajout direct). */
async function expectCartLineHasDimensions(page: Page) {
  const shelterList = page.getByRole('list', { name: /abris configurés/i });
  await expect(shelterList).toContainText(MODEL.name);
  await expect(shelterList).toContainText(/Largeur\s*:/);
  await expect(shelterList).toContainText(/11 pi/); // largeur 335 cm
  await expect(shelterList).toContainText(/Longueur\s*:/);
  await expect(shelterList).toContainText(/24 pi/); // longueur 732 cm
  await expect(shelterList).toContainText(/Hauteur\s*:/);
  await expect(shelterList).toContainText(/6 pi 6 po/); // hauteur 198 cm
}

test('Accueil : la carte vedette force la configuration → panier avec dimensions', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  // La section vedette rend la carte de modèle (titre h3) ; son CTA OUVRE l'overlay.
  await expect(page.getByRole('heading', { level: 3, name: MODEL.name })).toBeVisible();

  // GARDE : aucun bouton de la grille n'ajoute un abri DIRECTEMENT. Le seul libellé « …au panier »
  // visible avant ouverture de l'overlay est le CTA « Configurer et ajouter au panier — <modèle> ».
  await configureAndAdd(page);
  await gotoCartViaNavbar(page);
  await expectCartLineHasDimensions(page);
});

test('Boutique (catégorie) : add abri passe par l’overlay → panier avec dimensions', async ({ page }) => {
  await mockApi(page);
  await page.goto('/boutique');
  await page.getByRole('button', { name: CATEGORY.name }).click();
  await expect(page.getByRole('heading', { level: 2, name: MODEL.name })).toBeVisible();

  // GARDE comportementale : dans la vue catégorie d'abris, il n'existe AUCUN bouton « Ajouter au
  // panier » (libellé exact, sans « Configurer ») qui ajouterait un abri sans dimensions — le seul
  // bouton de carte porte le libellé « Configurer et ajouter au panier — <modèle> » (ouvre l'overlay).
  const directAdd = page.getByRole('button', { name: /^Ajouter au panier$/ });
  await expect(directAdd).toHaveCount(0);

  await configureAndAdd(page);
  await gotoCartViaNavbar(page);
  await expectCartLineHasDimensions(page);
});

test('Boutique (vue « Tous ») : add abri passe par l’overlay → panier avec dimensions', async ({ page }) => {
  await mockApi(page);
  await page.goto('/boutique');

  // Vue « Tous » par défaut (aucune catégorie sélectionnée) : les modèles d'abris sont rendus en
  // cartes (titre h2), l'achat passe par l'overlay (dimensions obligatoires).
  await expect(page.getByRole('heading', { level: 2, name: MODEL.name })).toBeVisible();

  // GARDE : pas d'ajout direct d'abri dans la vue « Tous » non plus.
  const directAdd = page.getByRole('button', { name: /^Ajouter au panier$/ });
  await expect(directAdd).toHaveCount(0);

  await configureAndAdd(page);
  await gotoCartViaNavbar(page);
  await expectCartLineHasDimensions(page);
});

test('Thème sombre : le parcours configure-only reste intact (accueil)', async ({ page }) => {
  await forceTheme(page, 'dark');
  await mockApi(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { level: 3, name: MODEL.name })).toBeVisible();

  await configureAndAdd(page);
  await gotoCartViaNavbar(page);
  await expectCartLineHasDimensions(page);
});
