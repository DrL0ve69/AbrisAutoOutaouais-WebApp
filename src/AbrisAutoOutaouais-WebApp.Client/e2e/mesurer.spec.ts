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

/**
 * Suggestion Photon-like servie par `suggest` (et donc par `geocode`, qui réutilise `suggest`).
 * `suggestJson` est paramétrable : `[]` par défaut (parcours sans suggestion), ou une liste
 * portant lat/lng pour exercer le géocodage à la soumission (D4) et la zone de service (D5).
 */
async function mockApi(page: Page, suggestJson: unknown[] = []): Promise<void> {
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: suggestJson }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );
  await page.route('**/api/v1/products/suggest-shelters*', (route) =>
    route.fulfill({ json: SHELTERS }),
  );
}

/** Fabrique une suggestion Photon-like (mêmes champs que `PlaceSuggestionDto`). */
function suggestion(lat: number, lng: number, city: string): unknown {
  return {
    label: `123 rue Principale, ${city}, QC`,
    civicNumber: '123',
    street: 'rue Principale',
    city,
    province: 'QC',
    postalCode: null,
    lat,
    lng,
  };
}

/**
 * Remplit l'étape Adresse au clavier (SANS choisir de suggestion) et passe à l'étape Mesure.
 *
 * Comme aucune suggestion n'est sélectionnée, `submit()` déclenche TOUJOURS un géocodage (qui
 * réutilise `places/suggest`) avant d'émettre l'adresse. On pose donc une BARRIÈRE réseau sur
 * cette requête (L-012, jamais de `waitForTimeout`) pour attendre sa résolution déterministe avant
 * l'avancement d'étape — qu'elle renvoie des coordonnées (mock D4/D5) ou une liste vide.
 */
async function completeAddress(page: Page, city = 'Gatineau'): Promise<void> {
  await page.goto('/mesurer');
  await expect(page.getByRole('heading', { level: 2, name: /adresse/i })).toBeVisible();

  await page.getByLabel(/numéro civique/i).fill('123');
  // Le champ « rue » est un combobox : on tape via le locator (auto-focus + actionability, L-012).
  await page.locator('#mesurer-rue').pressSequentially('123 rue Principale');
  await page.getByLabel(/ville/i).fill(city);

  // Barrière réseau : la requête de géocodage part au clic de soumission, on attend sa réponse
  // (la DERNIÈRE requête `suggest`, postérieure au clic) avant d'asserter l'avancement d'étape.
  const submit = page.getByRole('button', { name: /continuer vers la mesure/i });
  await Promise.all([
    page.waitForResponse((r) => /places\/suggest/.test(r.url())),
    submit.click(),
  ]);
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

// ── D4 — CENTRAGE RÉEL de la carte sur l'adresse géocodée (capacité, pas l'enveloppe — L-019). ──
//
// L'adresse est complétée SANS choisir de suggestion (saisie/préremplie) : la carte se centrait
// alors sur Gatineau (bug D4). Désormais `submit()` géocode (réutilise `suggest`) et pose lat/lng.
// On mocke `suggest` avec des coordonnées CONNUES (≠ base Gatineau) puis on prouve, via
// `window.ng.getComponent()` sur `app-map-measure`, que les inputs lat/lng valent EXACTEMENT les
// valeurs géocodées — donc que la carte est centrée sur l'adresse, pas sur le repli.
test('D4 — la carte est CENTRÉE sur l’adresse géocodée (pas sur Gatineau)', async ({ page }) => {
  test.setTimeout(60000);
  // Coordonnées en zone mais nettement distinctes de la base (45.4765/-75.7013).
  const GEO = { lat: 45.3201, lng: -75.8702 };
  await mockApi(page, [suggestion(GEO.lat, GEO.lng, 'Gatineau')]);
  await completeAddress(page, 'Gatineau');

  // Bascule en mode carte et attend le conteneur (barrière, jamais waitForTimeout — L-012).
  await page.getByRole('radio', { name: /mesurer sur la carte/i }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });

  // CAPACITÉ : on lit les inputs réels du composant carte servi (bundle courant, pas un zombie —
  // L-017). lat/lng DOIVENT être les valeurs géocodées, surtout PAS le repli Gatineau.
  const coords = await page.locator('app-map-measure').evaluate((el) => {
    const cmp = (window as unknown as { ng: { getComponent(node: Element): { lat(): number | null; lng(): number | null } } }).ng.getComponent(el);
    return { lat: cmp.lat(), lng: cmp.lng() };
  });
  expect(coords.lat).toBeCloseTo(GEO.lat, 4);
  expect(coords.lng).toBeCloseTo(GEO.lng, 4);
  // Garde explicite anti-régression : ce n'est PAS le repli Gatineau (45.4765 / -75.7013).
  expect(coords.lat).not.toBeCloseTo(45.4765, 3);
});

// ── D5 — AVERTISSEMENT « hors zone » (doux, NON bloquant) + CONTRASTE DUAL-THÈME. ───────────────
//
// Adresse géocodée hors zone (Montréal ~160 km) → un `role="status"` informe l'utilisateur sans
// bloquer la mesure. Le bandeau « hors zone » introduit des couleurs : `color-contrast` est
// DÉSACTIVÉ en vitest (L-016), donc on valide le contraste ICI (app réelle, `WCAG_TAGS` ⇒ règle
// incluse) dans LES DEUX thèmes (motion-a11y §2) — `/mesurer` n'étant pas couvert par le balayage
// dual-thème de `motion-a11y.spec.ts`.

/** Force le thème via localStorage AVANT navigation (même mécanisme que motion-a11y). */
function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

for (const theme of ['light', 'dark'] as const) {
  test(`D5 — hors zone : avertissement role="status", mesure possible, zéro axe contraste (${theme})`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await forceTheme(page, theme);
    // Montréal — hors zone de service.
    await mockApi(page, [suggestion(45.5019, -73.5674, 'Montréal')]);
    await completeAddress(page, 'Montréal');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // POSITIF (L-009) : l'avertissement « hors zone » est annoncé en role="status".
    const warning = page.getByText(/hors de notre zone de livraison/i);
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute('role', 'status');

    // CONTRASTE inclus (app réelle, WCAG_TAGS) sur l'ÉTAPE MESURE, où vit mon bandeau « hors zone »
    // (c'est ma surface) — `color-contrast` inclus, dans les deux thèmes (motion-a11y §2). On scanne
    // ici, pas l'étape résultats : la fiche d'abri y porte un défaut de contraste PRÉEXISTANT et hors
    // périmètre D4/D5 (`.shelter-card__badge` : #fff sur `--color-warning` amber en thème sombre,
    // 1.66:1) — suivi séparément (board.md). On n'élargit pas ce ticket à sa correction (L-008), mais
    // on ne masque pas non plus la régression : la garde de contraste de MON bandeau reste effective.
    const onMeasure = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(onMeasure.violations).toEqual([]);

    // NON BLOQUANT (fonctionnel, sans dépendre du thème) : on peut toujours mesurer jusqu'aux
    // résultats malgré l'avertissement « hors zone ».
    await page.getByLabel(/berline/i).fill('1');
    await page.getByRole('button', { name: /calculer le gabarit/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: /résultats/i })).toBeVisible();
  });
}
