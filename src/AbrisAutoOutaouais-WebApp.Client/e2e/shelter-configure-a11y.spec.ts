import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : a11y du parcours « configure-only » non couvert ailleurs (rework EPIC 9) ───────────────
//
// `shelter-overlay.spec.ts` couvre déjà l'overlay ouvert depuis la BOUTIQUE (axe dual-thème + contrat
// APG « dialog »). Ce fichier complète les DEUX surfaces restantes :
//
//   (a) OVERLAY ouvert depuis l'ACCUEIL (`/`, section vedette) — axe dual-thème (contraste INCLUS en
//       e2e, pas en vitest — L-016) + contrat APG complet : focus initial dans le dialogue, piège de
//       focus, Échap ferme ET rend le focus au déclencheur (L-006/L-040). Nom accessible non vide
//       même si le chemin de résolution traîne (L-040 : `getByRole('dialog', { name: /.+/ })`).
//   (b) LOCATION (`/location`) — liste des modèles louables + sélecteur de taille — axe dual-thème.
//
// PREUVE DE NON-VACUITÉ (L-005) : retirer `this.overlayTrigger?.focus()` dans `home.ts`
// (`closeConfigurator`) ferait échouer l'assertion « focus rendu au déclencheur après Échap »
// (il retomberait sur <body>).
//
// Mocks en MIROIR du provider réel (L-011) : forme `ShelterModel*Dto` / `RentableShelterModelDto`.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Grille de prix exacte (CENTS), hauteur unique 198 cm.
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
  categoryId: 'cat-simples',
  categoryName: 'Abris simples',
  basePrice: 1099,
  minLengthCm: 488,
  maxLengthCm: 1830,
  lengthStepCm: 122,
  priceGrid: buildGrid(488, 1830, 122, 109900),
  widthOptionsCm: [335],
  clearHeightOptionsCm: [198],
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

// Modèle LOUABLE (forme `RentableShelterModel`) pour /location.
const RENTABLE = {
  slug: MODEL.slug,
  name: MODEL.name,
  categoryName: MODEL.categoryName,
  monthlyRentalPrice: 149,
  minLengthCm: MODEL.minLengthCm,
  maxLengthCm: MODEL.maxLengthCm,
  lengthStepCm: MODEL.lengthStepCm,
  widthCm: 335,
  clearHeightOptionsCm: [198],
  priceGrid: MODEL.priceGrid,
};

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/categories', (route) =>
    route.fulfill({ json: [{ id: MODEL.categoryId, name: MODEL.categoryName, slug: 'abris-simples', productCount: 1 }] }),
  );
  await page.route('**/api/v1/products*', (route) =>
    route.fulfill({
      json: { items: [], totalCount: 0, pageNumber: 1, pageSize: 50, totalPages: 0, hasNext: false, hasPrev: false },
    }),
  );
  // `/shelters/rentable` AVANT les patterns `/shelters?*` / `/shelters` (plus spécifique → priorité).
  await page.route('**/api/v1/shelters/rentable', (route) => route.fulfill({ json: [RENTABLE] }));
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
 * Sur l'ACCUEIL, ouvre l'overlay depuis le CTA de la carte vedette (titre h3) et attend le 1er prix
 * serveur (barrière — L-012). Renvoie { dialog, trigger }.
 */
async function openHomeOverlay(page: Page) {
  await expect(page.getByRole('heading', { level: 3, name: MODEL.name })).toBeVisible();
  const trigger = page.getByRole('button', { name: new RegExp(`Configurer.*${MODEL.name}`) }).first();
  const firstPrice = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: MODEL.name });
  await expect(dialog).toBeVisible();
  await firstPrice;
  return { dialog, trigger };
}

for (const theme of ['light', 'dark'] as const) {
  test(`Accueil — overlay ouvert : aucune violation axe (contraste inclus) — thème ${theme}`, async ({ page }) => {
    await forceTheme(page, theme);
    await mockApi(page);
    await page.goto('/');
    const { dialog } = await openHomeOverlay(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // État positif : le prix est rendu (surface couleur de l'overlay) avant le scan.
    await expect(dialog.locator('.configurator__price-amount')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2),
    ).toEqual([]);
  });

  test(`Location — liste louable + sélecteur de taille : aucune violation axe — thème ${theme}`, async ({ page }) => {
    await forceTheme(page, theme);
    await mockApi(page);
    await page.goto('/location');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // h1 de la page + un modèle louable rendu (positif L-002).
    await expect(page.getByRole('heading', { level: 1, name: /louer un abri/i })).toBeVisible();
    const modelRadio = page.getByText(MODEL.name).first();
    await expect(modelRadio).toBeVisible();

    // On sélectionne le modèle pour RÉVÉLER le sélecteur de taille (longueur <select> + hauteur
    // radiogroup) et le scanner aussi — la surface dimensionnelle est ce qui change au rework EPIC 9.
    await modelRadio.click();
    await expect(page.getByRole('combobox', { name: /longueur/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2),
    ).toEqual([]);
  });
}

test('Accueil — contrat dialog APG : nom accessible non vide, focus initial piégé, Échap rend le focus au déclencheur', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/');
  const { dialog, trigger } = await openHomeOverlay(page);

  // (L-040) Nom accessible NON VIDE même sur un chemin de résolution lent.
  await expect(page.getByRole('dialog', { name: /.+/ })).toBeVisible();

  const focusInsideDialog = () => dialog.evaluate((d) => d.contains(document.activeElement));

  // (1) Focus initial DANS le dialogue après rendu (L-006). Le 1er focusable est « Fermer ».
  const closeBtn = dialog.getByRole('button', { name: /fermer la configuration/i });
  await expect(closeBtn).toBeFocused();
  expect(await focusInsideDialog()).toBe(true);

  // (2) Piège de focus : Shift+Tab depuis le 1er focusable reboucle DANS le dialogue ; Tab aussi.
  await page.keyboard.press('Shift+Tab');
  expect(await focusInsideDialog()).toBe(true);
  await page.keyboard.press('Tab');
  expect(await focusInsideDialog()).toBe(true);

  // (3) Échap FERME et rend le focus au bouton déclencheur de la carte vedette (WCAG 2.4.3).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
