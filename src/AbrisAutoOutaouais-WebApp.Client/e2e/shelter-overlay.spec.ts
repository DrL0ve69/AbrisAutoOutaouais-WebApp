import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : garde du nouvel OVERLAY de configuration (rework EPIC 9) ───────────────────────────────
//
// L'overlay (`app-shelter-configurator-overlay`, role=dialog + aria-modal) s'ouvre depuis le bouton
// « Ajouter au panier » d'une carte de modèle du catalogue. Deux axes :
//
//  (a) CONTRASTE DUAL-THÈME : pour chaque thème (clair + sombre), balayage axe (color-contrast
//      INCLUS en e2e, contrairement à vitest — L-016) sur l'overlay ouvert + la carte derrière.
//  (b) CONTRAT « dialog » APG (WCAG 2.4.3 / 2.1.2) :
//      - à l'ouverture, le focus est DANS le dialogue (après rendu — `afterNextRender`, L-006) ;
//      - Tab/Shift+Tab restent PIÉGÉS dans le dialogue ;
//      - Échap FERME et le focus REVIENT au bouton déclencheur de la carte (toHaveFocus()).
//
// PREUVE DE NON-VACUITÉ (L-005) : ces assertions échouent si on annule le correctif. Si l'overlay
// ne renvoyait pas le focus (`closeConfigurator` sans `overlayTrigger?.focus()`), l'assertion
// `toBeFocused()` sur le déclencheur après Échap échouerait (le focus retomberait sur <body>). Si
// le piège de focus était retiré (`onDialogKeydown` no-op), le Tab depuis le dernier élément
// sortirait du dialogue et `dialog` ne contiendrait plus l'élément actif. Si le focus initial
// n'était pas posé, l'assertion « focus dans le dialogue à l'ouverture » échouerait. Démo locale :
// commenter `this.overlayTrigger?.focus()` dans `catalog.ts` → le test (b) vire au rouge.
//
// Mock en MIROIR du provider réel (L-011) : forme `ShelterModel*Dto` (camelCase .NET), slug PAR
// LARGEUR (`simple-11pi`), `/price` calculé comme `ShelterPriceCalculator.cs`.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const CATEGORY = { id: 'cat-simples', name: 'Abris simples', slug: 'abris-simples', productCount: 1 };

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
  pricePerArchCents: 15000,
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

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [CATEGORY] }));
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
    const archCount = (lengthCm - MODEL.minLengthCm) / MODEL.lengthStepCm;
    const totalPrice = MODEL.basePrice + archCount * (MODEL.pricePerArchCents / 100);
    return route.fulfill({
      json: { modelId: MODEL.id, slug: MODEL.slug, lengthCm, archCount, totalPrice },
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
 * Navigue au catalogue paramétrique et renvoie le bouton CTA de la carte (le DÉCLENCHEUR) sans
 * l'ouvrir — pour vérifier le retour de focus dessus. Pas d'ouverture ici.
 */
async function gotoCatalogModel(page: Page) {
  await page.goto('/boutique');
  await page.getByRole('button', { name: CATEGORY.name }).click();
  await expect(page.getByRole('heading', { level: 2, name: MODEL.name })).toBeVisible();
  return page.getByRole('button', { name: new RegExp(`Configurer.*${MODEL.name}`) });
}

/** Ouvre l'overlay via le déclencheur fourni et attend le 1er prix serveur (barrière — L-012). */
async function openOverlay(page: Page, trigger: ReturnType<Page['getByRole']>) {
  const firstPrice = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: MODEL.name });
  await expect(dialog).toBeVisible();
  await firstPrice;
  return dialog;
}

for (const theme of ['light', 'dark'] as const) {
  test(`overlay : aucune violation axe (contraste inclus) — thème ${theme}`, async ({ page }) => {
    await forceTheme(page, theme);
    await mockApi(page);
    const trigger = await gotoCatalogModel(page);
    const dialog = await openOverlay(page, trigger);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // État positif : le prix est rendu (surface couleur de l'overlay présente) avant le scan.
    await expect(dialog.locator('.configurator__price-amount')).toBeVisible();

    // Scan pleine page : overlay ouvert (dialog + configurateur) ET carte de modèle derrière.
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('contrat dialog APG : focus initial dans le dialogue, piège de focus, Échap rend le focus au déclencheur', async ({
  page,
}) => {
  await mockApi(page);
  const trigger = await gotoCatalogModel(page);
  const dialog = await openOverlay(page, trigger);

  // Vrai si l'élément actif est un descendant du dialogue (focus toujours piégé dedans).
  const focusInsideDialog = () => dialog.evaluate((d) => d.contains(document.activeElement));

  // (1) Focus initial DANS le dialogue après rendu (L-006). Le 1er focusable est « Fermer ».
  const closeBtn = dialog.getByRole('button', { name: /fermer la configuration/i });
  await expect(closeBtn).toBeFocused();
  expect(await focusInsideDialog()).toBe(true);

  // (2) Piège de focus : Shift+Tab depuis le 1er focusable (« Fermer ») reboucle sur le DERNIER
  //     focusable du dialogue (jamais hors du dialogue). Le focus reste piégé.
  await page.keyboard.press('Shift+Tab');
  expect(await focusInsideDialog()).toBe(true);

  // Et un Tab depuis le dernier focusable reboucle vers le premier — toujours dans le dialogue.
  await page.keyboard.press('Tab');
  expect(await focusInsideDialog()).toBe(true);

  // (3) Échap FERME le dialogue ET rend le focus au bouton déclencheur de la carte (WCAG 2.4.3).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
