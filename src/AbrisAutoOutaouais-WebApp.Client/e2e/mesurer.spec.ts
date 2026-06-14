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
  // Marge au-delà du défaut 30 s : 1re compilation à froid du chunk Leaflet/geoman en CI.
  test.setTimeout(60000);
  await mockApi(page);

  // Diagnostic : remonte toute erreur JS/console côté navigateur dans les logs CI (le chunk
  // Leaflet/geoman est chargé dynamiquement ici pour la 1re fois — si l'import échoue, on veut
  // la cause exacte plutôt qu'un simple timeout).
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[browser:console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));

  await completeAddress(page);

  // Bascule en mode carte → déclenche le `@defer (on immediate)` (chargement sans scroll).
  await page.getByRole('radio', { name: /mesurer sur la carte/i }).click();

  // BARRIÈRE déterministe (L-012) : on attend l'apparition du conteneur Leaflet, jamais un
  // waitForTimeout. Depuis F2-D, geoman est importé AVANT `L.map(...)` (son init hook doit être
  // posé avant la construction de la carte — cf. `map-measure.ts`), donc `.leaflet-container`
  // n'apparaît plus indépendamment de geoman : le paint de la carte est gated sur le chunk geoman
  // (~360 kB). Timeout large (30 s) : en CI, ce test est le 1er à charger les chunks Leaflet+geoman
  // → compilation à la demande du dev-server à froid (contrairement au local « warm »).
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });

  // axe : on EXCLUT uniquement `.leaflet-container` (widget tiers Leaflet/geoman, mode
  // pointer-only documenté ; l'équivalent clavier complet est le calculateur de véhicules).
  // Tout le reste de la page (navbar, indicateur d'étapes, instructions) reste scanné.
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('.leaflet-container')
    .analyze();
  expect(results.violations).toEqual([]);
});

// ── ASSERTION POSITIVE de DESSINABILITÉ (L-005/L-009) — ferme le trou signalé en revue F2. ──────
//
// « la carte s'affiche » (`.leaflet-container` visible) ne prouve PAS qu'elle est DESSINABLE : geoman
// s'attache à `map.pm` par EFFET DE BORD à l'import ; si cet attachement n'a pas lieu, la garde
// `if (!pm) return;` (map-measure.ts) saute silencieusement `pm.addControls` → AUCUNE barre d'outils,
// dessin désactivé, et le smoke test ci-dessus reste vert quand même. Ce test transforme « la carte
// s'affiche » en « la carte EST dessinable » en exigeant la barre geoman (`.leaflet-pm-toolbar`) + un
// bouton de dessin (rectangle/polygone).
//
// ✅ CORRIGÉ F2-D : geoman (dist IIFE) lit `L` comme variable LIBRE résolue depuis `globalThis.L` ;
// il n'importe PAS Leaflet. Le composant importait Leaflet en module ESM local sans l'exposer
// globalement → `globalThis.L` était `undefined` → geoman ne patchait rien → `map.pm` jamais créé,
// barre de dessin absente (le faux-vert L-009 : le smoke ci-dessus restait vert alors que le dessin
// était silencieusement mort). La correction expose l'instance Leaflet dynamiquement importée sur
// `globalThis.L` AVANT d'importer geoman (cf. `map-measure.ts`). Ce test passe donc de `fixme` à
// actif et VÉRIFIE LA CAPACITÉ (la carte est DESSINABLE), pas seulement le conteneur — il exige la
// barre geoman (`.leaflet-pm-toolbar`) + un bouton de dessin (rectangle/polygone), assertion non
// affaiblie (L-019/L-009).
test(
  'CARTE dessinable : barre d’outils geoman présente (corrigé F2-D — geoman lit `globalThis.L`)',
  async ({ page }) => {
    test.setTimeout(60000);
    await mockApi(page);
    await completeAddress(page);
    await page.getByRole('radio', { name: /mesurer sur la carte/i }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });

    // POSITIF : la barre de DESSIN geoman ET un bouton de dessin sont rendus → la carte est
    // dessinable. geoman ajoute deux `.leaflet-pm-toolbar` (dessin + édition) ; on cible la barre de
    // DESSIN (`.leaflet-pm-draw`) pour lever l'ambiguïté du mode strict tout en gardant l'assertion
    // de CAPACITÉ (on n'affaiblit pas vers un simple conteneur — L-019/L-009).
    await expect(page.locator('.leaflet-pm-toolbar.leaflet-pm-draw')).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.locator('.leaflet-pm-icon-rectangle, .leaflet-pm-icon-polygon').first(),
    ).toBeVisible();
  },
);
