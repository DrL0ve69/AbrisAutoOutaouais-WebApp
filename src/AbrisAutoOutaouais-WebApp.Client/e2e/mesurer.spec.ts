import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : « Mesurer mon stationnement » (Epic D, D3) ────────────────────────────
//
// Deux scénarios :
//  (a) PARCOURS CLAVIER-ONLY via le calculateur de véhicules (défaut, SSR-safe) jusqu'aux
//      résultats — aucun recours à la carte. axe scanne la page entière, sans exclusion.
//  (b) SMOKE CARTE : bascule en mode carte, déclenche le `@defer (on viewport)`, attend
//      l'apparition de `.leaflet-container` (BARRIÈRE sur le conteneur, jamais waitForTimeout —
//      L-012), puis axe avec `.exclude('.leaflet-container')` (internes Leaflet/geoman tiers,
//      mode pointer-only documenté ; l'équivalent clavier est le calculateur).
//
// On mocke le proxy Places + suggest-shelters (aucun backend requis, comme a11y.spec.ts).

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const SHELTERS = [
  {
    id: 's1',
    name: 'Abri double Tempo 18x20',
    slug: 'abri-double',
    price: 899.99,
    rentalPrice: 79.99,
    categoryName: 'Abris doubles',
    imageUrl: null,
    widthCm: 320,
    lengthCm: 620,
    heightCm: 250,
    widthMarginCm: 10,
    lengthMarginCm: 20,
    isTightFit: true,
  },
];

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );
  await page.route('**/api/v1/products/suggest-shelters*', (route) =>
    route.fulfill({ json: SHELTERS }),
  );
}

/** Remplit l'étape Adresse au clavier et passe à l'étape Mesure. */
async function completeAddress(page: Page): Promise<void> {
  await page.goto('/mesurer');
  await expect(page.getByRole('heading', { level: 2, name: /adresse/i })).toBeVisible();

  await page.getByLabel(/numéro civique/i).fill('123');
  // Le champ « rue » est un combobox : on tape une valeur libre (les suggestions sont vides).
  const combo = page.locator('#mesurer-rue');
  await combo.fill('123 rue Principale');
  await page.getByLabel(/ville/i).fill('Gatineau');

  await page.getByRole('button', { name: /continuer vers la mesure/i }).click();
  await expect(page.getByRole('heading', { level: 2, name: /mesure/i })).toBeVisible();
}

test('parcours CLAVIER-ONLY (calculateur) → résultats + aucune violation axe', async ({
  page,
}) => {
  await mockApi(page);
  await completeAddress(page);

  // Mode calculateur = défaut : on saisit 1 berline et on calcule.
  const berline = page.getByLabel(/berline/i);
  await berline.fill('1');
  await page.getByRole('button', { name: /calculer le gabarit/i }).click();

  // Étape résultats : la carte mockée renvoie un abri « ajusté serré ».
  await expect(page.getByRole('heading', { level: 2, name: /résultats/i })).toBeVisible();
  await expect(page.getByText('Abri double Tempo 18x20')).toBeVisible();
  await expect(page.getByText(/ajusté serré/i)).toBeVisible();

  // axe : page entière, AUCUNE exclusion (pas de carte dans ce parcours).
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('smoke CARTE : @defer charge Leaflet, conteneur visible, axe (hors .leaflet-container)', async ({
  page,
}) => {
  await mockApi(page);
  await completeAddress(page);

  // Bascule en mode carte → déclenche le `@defer (on immediate)` (chargement sans scroll).
  await page.getByRole('radio', { name: /mesurer sur la carte/i }).click();

  // BARRIÈRE déterministe (L-012) : on attend l'apparition du conteneur Leaflet, jamais un
  // waitForTimeout. `@defer (on immediate)` + l'import dynamique + l'init asynchrone de la
  // carte aboutissent à `.leaflet-container` une fois la carte montée — déclenchement fiable
  // en CI headless (contrairement à `on viewport`, dont l'IntersectionObserver ne se
  // déclenchait pas de façon déterministe).
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

  // axe : on EXCLUT uniquement `.leaflet-container` (widget tiers Leaflet/geoman, mode
  // pointer-only documenté ; l'équivalent clavier complet est le calculateur de véhicules).
  // Tout le reste de la page (navbar, indicateur d'étapes, instructions) reste scanné.
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('.leaflet-container')
    .analyze();
  expect(results.violations).toEqual([]);
});
