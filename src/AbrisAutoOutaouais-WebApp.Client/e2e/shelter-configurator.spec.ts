import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : Configurateur paramétrique via l'OVERLAY du catalogue (rework EPIC 9) ─────────────────
//
// L'ancien flux est SUPPRIMÉ : plus de route `/boutique/configurer/:slug`, plus de heading
// « Configurez les dimensions », plus de champ number `#configurator-length-number`. À la place :
//   catalogue d'une catégorie paramétrique (`abris-simples`) → cartes `app-shelter-model-card` →
//   le bouton « Ajouter au panier » d'une carte OUVRE un overlay modal (role=dialog, aria-modal) →
//   dans l'overlay la LONGUEUR est un `<select>` natif (id `configurator-length-select`), la
//   HAUTEUR des radios APG, la LARGEUR une ligne statique (une seule option par modèle).
//
// Trois axes :
//  (a) RECALCUL DE PRIX : changer la longueur via `selectOption` (label en pieds) → barrière réseau
//      sur `/shelters/*/price` (jamais waitForTimeout — L-012) → prix mis à jour depuis la SOURCE
//      serveur (L-004), puis « Ajouter au panier » devient actif (aria-disabled=false — L-024).
//  (b) CONTRASTE : balayage axe DUAL-THÈME (clair + sombre, `color-contrast` inclus — non couvert
//      en vitest, L-016) sur l'overlay ouvert + la carte de modèle.
//
// On mocke les endpoints `/shelters` (aucun backend requis) en MIROIR du provider réel (L-011) :
//   forme `ShelterModelSummaryDto` / `ShelterModelDetailDto` / `ShelterPriceDto` (camelCase .NET),
//   slugs PAR LARGEUR (`simple-11pi`, largeur unique 335 cm → ligne statique), et `/price` servi par
//   LOOKUP dans la grille (modèle × longueur × hauteur) ; couple absent → 422 (grille éparse).

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Construit un matcher de prix fr-CA tolérant au séparateur de milliers : selon le jeu ICU, le
 * séparateur peut être une espace insécable (U+00A0) ou une fine insécable (U+202F), que `\s` ne
 * couvre pas toujours. On accepte l'un ou l'autre (ou rien) — ex. `priceRe(1099)` ⇒ « 1 099,00 ».
 */
function priceRe(amount: number): RegExp {
  const thousands = Math.floor(amount / 1000);
  const rest = String(amount % 1000).padStart(3, '0');
  return new RegExp(`${thousands}[\\s\\u00A0\\u202F]?${rest},00`);
}

// Catégorie paramétrique (chip du catalogue) — slug reconnu par `PARAMETRIC_CATEGORY_SLUGS`.
const CATEGORY = { id: 'cat-simples', name: 'Abris simples', slug: 'abris-simples', productCount: 2 };

// Grille de prix exacte (CENTS), une seule hauteur (198 cm). Prix = base + (longueur−min)/pas × 150 $.
function buildGrid(minLengthCm: number, maxLengthCm: number, stepCm: number, baseCents: number) {
  const grid: { lengthCm: number; clearHeightCm: number; priceCents: number }[] = [];
  for (let l = minLengthCm; l <= maxLengthCm; l += stepCm) {
    grid.push({ lengthCm: l, clearHeightCm: 198, priceCents: baseCents + ((l - minLengthCm) / stepCm) * 15000 });
  }
  return grid;
}

// Modèle PAR LARGEUR (miroir de `ShelterModelSeeder.cs` → spec `simple-11pi`) :
//  - largeur UNIQUE 335 cm (« 11 pi ») → ligne statique (pas de radiogroup) ;
//  - hauteur 198 cm (« 6 pi 6 po ») ;
//  - longueur 488→1830 cm par pas de 122 cm (« 16 pi » → « 60 pi »), prix issu de la GRILLE.
const MODEL = {
  id: 'm-simple-11pi',
  slug: 'simple-11pi',
  name: 'Abri simple 11 pi — Abris Tempo',
  categoryId: CATEGORY.id,
  categoryName: CATEGORY.name,
  basePrice: 1099, // « à partir de » = min de la grille
  minLengthCm: 488,
  maxLengthCm: 1830,
  lengthStepCm: 122,
  priceGrid: buildGrid(488, 1830, 122, 109900),
  widthOptionsCm: [335],
  clearHeightOptionsCm: [198],
};

// Résumé exposé par `GET /shelters?category=…` (ShelterModelSummaryDto — sans options largeur/hauteur).
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
  // Catégories : expose la catégorie paramétrique (chip cliquable du catalogue).
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [CATEGORY] }));

  // Produits fixes : vides (le 1er chargement « Tous » et les autres catégories n'ont rien à montrer).
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

  // Catalogue paramétrique : liste des modèles de la catégorie.
  await page.route('**/api/v1/shelters?*', (route) => route.fulfill({ json: [SUMMARY] }));
  await page.route('**/api/v1/shelters', (route) => route.fulfill({ json: [SUMMARY] }));

  // Détail du modèle (options largeur/hauteur incluses).
  await page.route(`**/api/v1/shelters/${MODEL.slug}`, (route) => route.fulfill({ json: MODEL }));

  // Prix serveur : LOOKUP dans la grille par (longueur, hauteur). Couple absent → 422.
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
 * Ouvre le catalogue, sélectionne la catégorie paramétrique, clique le CTA d'une carte de modèle,
 * et attend l'ouverture de l'overlay + le 1er prix serveur (barrière réseau — L-012). Retourne le
 * dialogue et le bouton déclencheur (pour vérifier le retour de focus en cas de besoin).
 */
async function openOverlay(page: Page) {
  await page.goto('/boutique');

  // Sélectionne la catégorie paramétrique (chip filtre) → charge les cartes de modèles.
  await page.getByRole('button', { name: CATEGORY.name }).click();

  // Carte de modèle rendue (état positif avant interaction).
  const heading = page.getByRole('heading', { level: 2, name: MODEL.name });
  await expect(heading).toBeVisible();

  // CTA de la carte : ouvre l'overlay. Barrière sur le 1er calcul de prix du configurateur.
  const trigger = page.getByRole('button', { name: new RegExp(`Configurer.*${MODEL.name}`) });
  const firstPrice = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: MODEL.name });
  await expect(dialog).toBeVisible();
  await firstPrice;
  return { dialog, trigger };
}

test('overlay : ajuste la longueur via <select> → prix recalculé (source serveur) → ajout au panier', async ({
  page,
}) => {
  await mockApi(page);
  const { dialog } = await openOverlay(page);

  // Montant affiché (scopé à la classe pour ne pas heurter l'annonce aria-live qui répète le prix).
  const priceAmount = dialog.locator('.configurator__price-amount');
  // Longueur initiale = min 488 cm (« 16 pi ») → 0 arche → 1099 $.
  await expect(priceAmount).toContainText(priceRe(1099));

  // « Ajouter au panier » actif (aria-disabled=false) une fois le 1er prix confirmé.
  const addBtn = dialog.getByRole('button', { name: /ajouter au panier/i });
  await expect(addBtn).toHaveAttribute('aria-disabled', 'false');

  // Change la longueur via le <select> natif : on cible par LABEL (option en pieds, [ngValue]).
  // 732 cm = 488 + 2 pas → « 24 pi » → 2 arches → 1099 + 300 = 1399 $.
  const lengthSelect = dialog.locator('#configurator-length-select');
  const priceResp = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await lengthSelect.selectOption({ label: '24 pi' });
  await priceResp;
  await expect(priceAmount).toContainText(priceRe(1399));

  // Ajout au panier : le bouton est actif, et l'ajout FERME l'overlay tout seul (le parent ferme +
  // affiche un toast + rend le focus au déclencheur) — plus d'annonce aria-live interne.
  await expect(addBtn).toHaveAttribute('aria-disabled', 'false');
  await addBtn.click();
  await expect(dialog).toBeHidden();
});

for (const theme of ['light', 'dark'] as const) {
  test(`aucune violation axe (contraste inclus) — overlay + carte, thème ${theme}`, async ({
    page,
  }) => {
    await forceTheme(page, theme);
    await mockApi(page);
    const { dialog } = await openOverlay(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // Le prix est rendu (état positif) avant le scan — la surface couleur est présente.
    await expect(dialog.locator('.configurator__price-amount')).toContainText(priceRe(1099));

    // Scan pleine page : couvre l'overlay ouvert ET la carte de modèle du catalogue derrière.
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
}
