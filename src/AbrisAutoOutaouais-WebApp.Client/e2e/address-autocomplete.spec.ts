import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : combobox d'autocomplétion d'adresse (ARIA APG), au CLAVIER seul.
//
// On mocke le proxy Places (suggest + lookup-postal-code) — aucun backend requis,
// comme a11y.spec.ts. Le parcours est entièrement clavier ; axe scanne la page
// ENTIÈRE (navbar incluse), sans exclusion (L-008 : pas de scope qui masque un bug).
// Page testée : /location, dont le champ « Rue » porte id="street".
//
// DÉTERMINISME (anti-flake) : la listbox ne se peuple qu'APRÈS une requête réseau
// `places/suggest` debouncée (300 ms) + réponse async. En suite complète, asserter
// les options / naviguer aux flèches AVANT que la réponse mockée n'arrive donne 0
// option (la frappe caractère-par-caractère re-arme le debounce, et `ArrowDown` ne
// fait rien tant que `suggestions` est vide). On franchit donc explicitement une
// barrière `waitForResponse('**/api/v1/places/suggest*')` autour de la frappe, puis
// on attend l'état rendu (`toBeVisible`/`toHaveCount`) — jamais de `waitForTimeout`.
// La couverture clavier APG (↓/↑/Entrée/Échap) reste intégralement exercée APRÈS la
// barrière. Status ancré PAR TEXTE (L-010 : un role="status" global existe dans app.html).

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

/**
 * Frappe « rue Well » dans le combobox et attend DÉTERMINISTEMENT que la requête
 * `places/suggest` mockée ait été servie avant de rendre la main.
 *
 * Garanties anti-flake :
 *  1. On frappe via `combo.pressSequentially(...)` (et non `page.keyboard.type`) : le
 *     locator AUTO-ATTEND que l'input soit actionnable et y porte le focus de façon
 *     fiable, là où `page.keyboard.type` envoie au nœud actuellement focalisé.
 *  2. La page est SSR + hydratée. Tant que l'hydratation Angular n'a pas (re)câblé le
 *     listener `(input)` du combobox, la frappe pose la valeur native mais ne déclenche
 *     NI `valueChange` NI le flux `suggest` debouncé → combobox « vide » côté Angular,
 *     aucun appel réseau, et `waitForResponse` partait en timeout (le flake observé en
 *     suite chargée). On enveloppe donc toute l'amorce (vider → frapper → réponse →
 *     listbox peuplée) dans `expect(...).toPass()` : si une attente d'hydratation avale
 *     la première tentative, Playwright la REJOUE jusqu'à ce que le pipeline complet
 *     réussisse, de façon déterministe et sans `waitForTimeout` arbitraire. La barrière
 *     `waitForResponse` est armée AVANT la frappe (la réponse, debouncée, arrive juste
 *     après la dernière touche).
 *
 * `pressSequentially` émet un `input` par caractère : le chemin debounce/`switchMap`
 * du composant reste exercé. Le focus DOM reste sur l'input (roving via
 * `aria-activedescendant`), donc `page.keyboard.press(...)` pour ↓/↑/Entrée/Échap qui
 * suit continue de cibler le combobox — la couverture clavier APG reste intacte.
 */
async function typeStreetAndAwaitSuggestions(page: Page, combo: Locator): Promise<void> {
  await expect(async () => {
    await combo.fill('');
    const suggestResponse = page.waitForResponse('**/api/v1/places/suggest*', { timeout: 5000 });
    await combo.pressSequentially('rue Well');
    await suggestResponse;
    await expect(combo).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
    await expect(page.getByRole('option')).toHaveCount(2, { timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

test('frappe → la listbox s’ouvre et le compteur est annoncé', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await typeStreetAndAwaitSuggestions(page, combo);

  // Compteur ANCRÉ PAR TEXTE (L-010 : un role="status" global existe dans app.html).
  await expect(
    page.getByRole('status').filter({ hasText: /adresse\(s\) trouvée\(s\)/i }),
  ).toBeVisible();
});

test('↓↓ déplace aria-activedescendant le long des options', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await typeStreetAndAwaitSuggestions(page, combo);

  await page.keyboard.press('ArrowDown');
  await expect(combo).toHaveAttribute('aria-activedescendant', 'street-option-0');
  await page.keyboard.press('ArrowDown');
  await expect(combo).toHaveAttribute('aria-activedescendant', 'street-option-1');
});

test('Entrée remplit les champs d’adresse et le code postal (éditable)', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await typeStreetAndAwaitSuggestions(page, combo);

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
  await typeStreetAndAwaitSuggestions(page, combo);

  await page.keyboard.press('Escape');
  await expect(combo).toHaveAttribute('aria-expanded', 'false');
  await expect(combo).toBeFocused();
});

test('lookup null → le code postal n’est pas patché et l’indisponibilité est annoncée (D2)', async ({ page }) => {
  await mockPlaces(page, null); // le proxy ne résout aucun code postal
  await gotoLocation(page);

  const combo = page.locator('#street');
  await typeStreetAndAwaitSuggestions(page, combo);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.locator('#city')).toHaveValue('Ottawa');
  // Aucun code postal patché — mais le champ reste éditable pour la saisie manuelle.
  await expect(page.locator('#postalCode')).toHaveValue('');
  await expect(page.locator('#postalCode')).toBeEditable();
  // Pas d'annonce « rempli automatiquement »…
  await expect(
    page.getByRole('status').filter({ hasText: /code postal rempli automatiquement/i }),
  ).toHaveCount(0);
  // …mais une annonce POSITIVE d'indisponibilité, scopée par texte (L-002/L-009/L-010).
  await expect(
    page.getByRole('status').filter({ hasText: /code postal introuvable/i }),
  ).toBeVisible();
});

test('suggestion sans civicNumber + civique pré-saisi → la valeur saisie est conservée (D1)', async ({
  page,
}) => {
  // Suggestion SANS numéro civique ni numéro en tête de libellé : la cascade D1 doit retomber
  // sur la valeur déjà saisie dans le champ « N° civique » et ne jamais l'écraser par ''.
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: RENTABLE_PRODUCTS }));
  await page.route('**/api/v1/places/suggest*', (route) =>
    route.fulfill({
      json: [
        {
          label: 'rue Wellington, Ottawa, ON', // pas de numéro en tête
          civicNumber: null,
          street: 'rue Wellington',
          city: 'Ottawa',
          province: 'ON',
          postalCode: null,
          lat: null,
          lng: null,
        },
      ],
    }),
  );
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );

  await gotoLocation(page);

  // L'utilisateur saisit d'abord son numéro civique.
  // ⚠️ Page SSR + hydratée (L-012) : tant que le ControlValueAccessor du champ « N° civique »
  // n'est pas (re)câblé par l'hydratation Angular, un `fill()` pose la valeur native mais le
  // modèle de formulaire reste vide (contrôle `ng-pristine`/valeur '') ; au prochain cycle de
  // détection (le patch de la suggestion), Angular réécrit son modèle vide par-dessus le DOM et
  // EFFACE le « 77 » → l'assertion finale recevait '' (flake CI-only, vert en local car
  // l'hydratation y est plus rapide). On enveloppe donc la saisie dans `expect(...).toPass()` :
  // si l'hydratation avale la première frappe, Playwright la REJOUE jusqu'à ce qu'Angular ait
  // réellement enregistré la valeur (contrôle devenu `dirty` + `toHaveValue('77')`), sans
  // `waitForTimeout`. Même discipline anti-race que la frappe du combobox plus bas.
  const civic = page.locator('#civicNumber');
  await expect(async () => {
    await civic.fill('77');
    await expect(civic).toHaveValue('77', { timeout: 2000 });
  }).toPass({ timeout: 15000 });

  const combo = page.locator('#street');
  await expect(async () => {
    await combo.fill('');
    const suggestResponse = page.waitForResponse('**/api/v1/places/suggest*', { timeout: 5000 });
    await combo.pressSequentially('rue Well');
    await suggestResponse;
    await expect(combo).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
    await expect(page.getByRole('option')).toHaveCount(1, { timeout: 5000 });
  }).toPass({ timeout: 25000 });

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // Rue/ville/province patchées, mais le civique saisi est PRÉSERVÉ (jamais écrasé par '').
  await expect(combo).toHaveValue('rue Wellington');
  await expect(page.locator('#city')).toHaveValue('Ottawa');
  await expect(page.locator('#civicNumber')).toHaveValue('77');
});

test('aucune violation axe (page entière, listbox ouverte)', async ({ page }) => {
  await mockPlaces(page, 'K1A 0A6');
  await gotoLocation(page);

  const combo = page.locator('#street');
  await typeStreetAndAwaitSuggestions(page, combo);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});
