import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : Configurateur de dimensions paramétrique (EPIC 9.3) ────────────────────────────────────
//
// Trois axes :
//  (a) RECALCUL DE PRIX : changer largeur/hauteur/longueur → barrière réseau sur `/shelters/*/price`
//      (jamais waitForTimeout — L-012) → prix + arches mis à jour depuis la SOURCE serveur (L-004).
//  (b) CLAVIER : radiogroups largeur/hauteur conformes APG (flèche bascule la sélection ET le focus).
//  (c) CONTRASTE : balayage axe DUAL-THÈME (clair + sombre, `color-contrast` inclus — non couvert
//      en vitest, L-016).
//
// On mocke les 3 endpoints `/shelters` (aucun backend requis). Le mock `/price` calcule la réponse
// à partir du `lengthCm` demandé, en MIROIR de `ShelterPriceCalculator.cs` (base 349 $, 100 $/arche,
// min 122 cm, pas 122 cm) — pour que les assertions soient déterministes.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const MODEL = {
  id: 'm1',
  slug: 'simple',
  name: 'Abri simple — Abris Tempo',
  categoryName: 'Abris simples',
  basePrice: 349,
  minLengthCm: 122,
  maxLengthCm: 1830,
  lengthStepCm: 122,
  pricePerArchCents: 10000, // 100 $ / arche
  widthOptionsCm: [335, 366],
  clearHeightOptionsCm: [198, 244],
};

async function mockApi(page: Page): Promise<void> {
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

/** Ouvre la page de configuration et attend le 1er prix serveur (barrière réseau — L-012). */
async function gotoConfigurator(page: Page): Promise<void> {
  const firstPrice = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await page.goto('/boutique/configurer/simple');
  await expect(page.getByRole('heading', { level: 1, name: /configurez les dimensions/i })).toBeVisible();
  await firstPrice;
}

test('recalcule le prix au changement de longueur (source serveur, barrière réseau)', async ({
  page,
}) => {
  await mockApi(page);
  await gotoConfigurator(page);

  // Montant affiché (scopé à la classe pour ne pas heurter l'annonce aria-live qui répète le prix).
  const priceAmount = page.locator('.configurator__price-amount');
  // Prix initial : longueur min 122 cm → 0 arche → 349 $.
  await expect(priceAmount).toContainText(/349,00/);

  // Change la longueur via le champ number (lié au range). Barrière sur la requête `/price`.
  const number = page.locator('#configurator-length-number');
  const priceResp = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await number.fill('366');
  await priceResp;

  // 366 cm = min + 2 pas → 2 arches → 349 + 200 = 549 $.
  await expect(priceAmount).toContainText(/549,00/);
});

test('radiogroup largeur APG : flèche bascule la sélection ET déplace le focus', async ({ page }) => {
  await mockApi(page);
  await gotoConfigurator(page);

  const first = page.getByRole('radio', { name: '11 pi' });
  const second = page.getByRole('radio', { name: '12 pi' });

  await expect(first).toHaveAttribute('aria-checked', 'true');
  await expect(first).toHaveAttribute('tabindex', '0');
  await expect(second).toHaveAttribute('tabindex', '-1');

  await first.focus();
  await page.keyboard.press('ArrowRight');

  await expect(second).toHaveAttribute('aria-checked', 'true');
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('tabindex', '0');
  await expect(first).toHaveAttribute('tabindex', '-1');
});

for (const theme of ['light', 'dark'] as const) {
  test(`aucune violation axe (contraste inclus) — thème ${theme}`, async ({ page }) => {
    await forceTheme(page, theme);
    await mockApi(page);
    await gotoConfigurator(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // Le prix est rendu (état positif) avant le scan — la surface couleur est présente.
    await expect(page.locator('.configurator__price-amount')).toContainText(/349,00/);

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
}
