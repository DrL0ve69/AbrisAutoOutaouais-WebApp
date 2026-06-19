import { test, expect, type Page } from '@playwright/test';

// ── e2e : ajout d'un ABRI CONFIGURÉ au panier (rework EPIC 9) ────────────────────────────────────
//
// L'ancien flux est SUPPRIMÉ (route `/boutique/configurer/:slug`, heading « Configurez les
// dimensions », champ number `#configurator-length-number`). Nouveau parcours, en INVITÉ (aucun
// auth_token) :
//   catalogue d'une catégorie paramétrique → carte `app-shelter-model-card` → overlay modal →
//   choix de la LONGUEUR via `<select>` (label en pieds) → barrière réseau sur `/shelters/*/price`
//   → « Ajouter au panier » → le panier affiche LARGEUR + LONGUEUR + HAUTEUR (en pieds) + le prix.
//
// La largeur est IMPLICITE dans le slug (un modèle = une largeur) mais le panier la RÉAFFICHE
// (ShelterCartItem.widthCm). Le panier étant un signal EN MÉMOIRE, on navigue en SPA (clic sur le
// lien Panier de la navbar) après l'ajout — un `goto` rechargerait et viderait le panier.
//
// Mock en MIROIR du provider réel (L-011) : forme `ShelterModel*Dto` (camelCase .NET), slug PAR
// LARGEUR (`simple-11pi`, largeur unique 335 cm → « 11 pi »), `/price` calculé comme
// `ShelterPriceCalculator.cs`.

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

test('configurer un abri dans l’overlay → ajouter au panier → le panier montre largeur + longueur + hauteur', async ({
  page,
}) => {
  await mockApi(page);

  await page.goto('/boutique');
  await page.getByRole('button', { name: CATEGORY.name }).click();
  await expect(page.getByRole('heading', { level: 2, name: MODEL.name })).toBeVisible();

  // Ouvre l'overlay depuis le CTA de la carte ; barrière sur le 1er prix serveur (L-012).
  const firstPrice = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await page.getByRole('button', { name: new RegExp(`Configurer.*${MODEL.name}`) }).click();
  const dialog = page.getByRole('dialog', { name: MODEL.name });
  await expect(dialog).toBeVisible();
  await firstPrice;

  // Choisir une longueur de 732 cm (= min + 2 pas) → « 24 pi » ; barrière sur la requête `/price`.
  const priceResp = page.waitForResponse((r) => /shelters\/.*\/price/.test(r.url()));
  await dialog.locator('#configurator-length-select').selectOption({ label: '24 pi' });
  await priceResp;

  // « Ajouter au panier » : actif (aria-disabled=false) une fois le prix confirmé.
  const addBtn = dialog.getByRole('button', { name: /ajouter au panier/i });
  await expect(addBtn).toHaveAttribute('aria-disabled', 'false');
  await addBtn.click();

  // L'overlay reste ouvert après l'ajout (confirmation annoncée) ; on le ferme (Échap) avant de
  // naviguer, sinon le fond modal (`overlay__backdrop`) intercepte le clic sur la navbar.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Navigation SPA vers le panier (clic navbar — pas de goto qui viderait le panier en mémoire).
  await page.getByRole('link', { name: /^Panier/ }).first().click();
  await expect(page).toHaveURL(/\/panier$/);

  // La liste « Abris configurés » affiche le modèle + les 3 dimensions EN PIEDS.
  const shelterList = page.getByRole('list', { name: /abris configurés/i });
  await expect(shelterList).toContainText(MODEL.name);
  await expect(shelterList).toContainText(/Largeur\s*:/);
  await expect(shelterList).toContainText(/11 pi/); // largeur 335 cm (réaffichée bien qu'implicite au slug)
  await expect(shelterList).toContainText(/Longueur\s*:/);
  await expect(shelterList).toContainText(/24 pi/); // longueur 732 cm
  await expect(shelterList).toContainText(/Hauteur\s*:/);
  await expect(shelterList).toContainText(/6 pi 6 po/); // hauteur 198 cm
});
