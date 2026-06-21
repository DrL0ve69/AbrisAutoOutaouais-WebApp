import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : « Trouver mon abri » (/mesurer) — flux Dimensionner → Conseil (EPIC 13) ────────────────
//
// EPIC 13 a INVERSÉ/simplifié l'assistant : il n'y a plus d'étape « Adresse » préalable. Le stepper
// est à 2 étapes —
//   1. « Dimensionner » : radiogroup APG à 3 VOIES (`known` / `vehicles` (défaut) / `map`) ;
//      la voie `map` porte DÉSORMAIS l'input adresse + la carte satellite sur la MÊME page (13.2).
//   2. « Conseil » : modèles d'abris compatibles (ex-« Résultats », renommé en 13.3, logique inchangée).
//
// Cette suite couvre les TROIS voies (L-037 — la migration e2e est le cœur de 13.3) :
//   (a) `known`    — saisie largeur/longueur en pieds → Conseil + suggestions ;
//   (b) `vehicles` — au CLAVIER (radiogroup APG : flèches sélectionnent la voie) → calculateur →
//                    Conseil + axe page entière ;
//   (c) `map`      — choisir la voie → remplir l'adresse (locator `pressSequentially` + barrière
//                    réseau `waitForResponse(/places\/suggest/)`, L-012) → géocodage centre la carte
//                    (D4) → carte DESSINABLE (capacité `.leaflet-pm-toolbar.leaflet-pm-draw`, L-019) ;
//                    plus l'avertissement « hors zone » (D5, `role="status"`) et le contraste dual-thème.
//
// On mocke le proxy Places + /shelters/suggest (aucun backend requis, comme a11y.spec.ts).

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Suggestion groupée par catégorie (EPIC 10, US-10.1) — miroir de `ShelterFitResult[]`.
const SUGGESTIONS = [
  {
    categorySlug: 'abris-doubles',
    categoryName: 'Abris doubles',
    categoryMaxWidthCm: 488,
    models: [
      {
        id: 's1',
        slug: 'double-pointu-16pi',
        name: 'Abri double pointu 16 pi',
        widthCm: 488,
        basePrice: 1899,
        minLengthCm: 488,
        lengthStepCm: 122,
        availableLengthsCm: [488, 610, 732],
      },
    ],
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
  await page.route('**/api/v1/shelters/suggest*', (route) =>
    route.fulfill({ json: SUGGESTIONS }),
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

/**
 * Sélectionne une voie du radiogroup à 3 voies de l'étape « Dimensionner ».
 * Les voies sont des boutons `role="radio"` ; un clic suffit (le clavier est exercé à part).
 */
async function chooseVoie(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('radio', { name }).click();
}

/**
 * Renseigne l'adresse de la voie carte (SANS choisir de suggestion) puis centre la carte.
 *
 * Comme aucune suggestion n'est choisie, « Centrer la carte sur cette adresse » déclenche TOUJOURS
 * un géocodage (qui réutilise `places/suggest`). On pose donc une BARRIÈRE réseau sur cette requête
 * (L-012, jamais de `waitForTimeout`) pour attendre sa résolution déterministe — qu'elle renvoie des
 * coordonnées (mock D4/D5) ou une liste vide.
 */
async function fillMapAddress(page: Page, city = 'Gatineau'): Promise<void> {
  await page.getByLabel(/numéro civique/i).fill('123');
  // Le champ « rue » est un combobox : on tape via le locator (auto-focus + actionability, L-012).
  await page.locator('#mesurer-rue').pressSequentially('123 rue Principale');
  await page.getByLabel(/ville/i).fill(city);

  // Barrière réseau : la requête de géocodage part au clic, on attend sa réponse (la DERNIÈRE
  // requête `suggest`, postérieure au clic) avant d'asserter le centrage de la carte.
  const center = page.getByRole('button', { name: /centrer la carte sur cette adresse/i });
  await Promise.all([
    page.waitForResponse((r) => /places\/suggest/.test(r.url())),
    center.click(),
  ]);
}

// ── (a) VOIE `known` — je connais mes dimensions → Conseil + suggestions. ────────────────────────
test('voie « connue » : saisie en pieds → étape Conseil avec suggestions', async ({ page }) => {
  await mockApi(page);
  await page.goto('/mesurer');

  // On arrive directement à l'étape « Dimensionner » (plus d'étape adresse préalable).
  await expect(page.getByRole('heading', { level: 2, name: /dimensionner/i })).toBeVisible();

  // Bascule sur la voie « Je connais mes dimensions » et saisis largeur × longueur (pieds).
  await chooseVoie(page, /je connais mes dimensions/i);
  await page.getByLabel(/largeur \(pi\)/i).fill('16');
  await page.getByLabel(/longueur \(pi\)/i).fill('30');
  await page.getByRole('button', { name: /voir les abris compatibles/i }).click();

  // Étape « Conseil » (EPIC 10) : titre d'étape + catégorie/modèle compatibles.
  await expect(page.getByRole('heading', { level: 2, name: /^conseil$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abris doubles' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abri double pointu 16 pi' })).toBeVisible();
});

// ── (b) VOIE `vehicles` (défaut) au CLAVIER — radiogroup APG → calculateur → Conseil + axe page. ──
test('voie « véhicules » au CLAVIER (radiogroup APG) → Conseil + aucune violation axe', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/mesurer');
  await expect(page.getByRole('heading', { level: 2, name: /dimensionner/i })).toBeVisible();

  // Radiogroup APG des 3 voies (ordre DOM : connue, véhicules, carte). « Par mes véhicules » est la
  // voie par défaut (sélectionnée + seul stop de tabulation — roving tabindex, L-015). On vérifie le
  // contrat clavier APG : les flèches déplacent la sélection RELATIVEMENT à l'option sélectionnée (pas
  // à l'élément focalisé) et déplacent ET sélectionnent ensemble. Depuis « véhicules » : flèche gauche
  // → « connue » (sélectionnée + focalisée) ; flèche droite → retour à « véhicules ».
  const known = page.getByRole('radio', { name: /je connais mes dimensions/i });
  const vehicles = page.getByRole('radio', { name: /par mes véhicules/i });
  await expect(vehicles).toHaveAttribute('aria-checked', 'true'); // défaut

  await vehicles.focus();
  await expect(vehicles).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(known).toHaveAttribute('aria-checked', 'true');
  await expect(known).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(vehicles).toHaveAttribute('aria-checked', 'true');
  await expect(vehicles).toBeFocused();

  // Calculateur (voie véhicules) : 1 berline → calcule le gabarit.
  await page.getByLabel(/berline/i).fill('1');
  await page.getByRole('button', { name: /calculer le gabarit/i }).click();

  // Étape « Conseil » : catégorie → modèle compatible → longueurs admissibles (en pieds).
  await expect(page.getByRole('heading', { level: 2, name: /^conseil$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abri double pointu 16 pi' })).toBeVisible();
  const lengthsLine = page.getByText(/longueurs offertes/i);
  await expect(lengthsLine).toContainText('16,0');
  await expect(lengthsLine).toContainText('24,0');

  // Lien « Configurer » → catalogue, pré-rempli (catégorie + slug + plus grande longueur = 732).
  const configureLink = page.getByRole('link', {
    name: /configurer le modèle abri double pointu 16 pi/i,
  });
  await expect(configureLink).toHaveAttribute(
    'href',
    '/boutique?category=abris-doubles&configure=double-pointu-16pi&length=732',
  );

  // axe : page entière, AUCUNE exclusion (pas de carte dans ce parcours).
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

// ── EPIC 10, US-10.2 — ORIENTATION (radiogroup APG visible à ≥ 2 véhicules, navigation clavier). ─
test('orientation : radiogroup APG visible à ≥ 2 véhicules, flèche bascule la sélection (clavier)', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/mesurer');
  await expect(page.getByRole('heading', { level: 2, name: /dimensionner/i })).toBeVisible();

  // Voie « véhicules » est le défaut : 1 berline → pas de sélecteur d'orientation.
  await page.getByLabel(/berline/i).fill('1');
  await expect(
    page.getByRole('radiogroup', { name: /disposition des véhicules/i }),
  ).toHaveCount(0);

  // 2 berlines → le radiogroup d'orientation apparaît.
  await page.getByLabel(/berline/i).fill('2');
  const group = page.getByRole('radiogroup', { name: /disposition des véhicules/i });
  await expect(group).toBeVisible();

  const side = page.getByRole('radio', { name: /côte à côte/i });
  const behind = page.getByRole('radio', { name: /l'un derrière l'autre/i });
  await expect(side).toHaveAttribute('aria-checked', 'true');

  // Navigation clavier APG : flèche droite bascule la sélection sur l'autre option.
  await side.focus();
  await page.keyboard.press('ArrowRight');
  await expect(behind).toHaveAttribute('aria-checked', 'true');
  await expect(behind).toBeFocused();

  // axe sur l'étape Dimensionner avec le radiogroup d'orientation rendu.
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

// ── EPIC 13 — CONTRASTE DUAL-THÈME de l'étape DIMENSIONNER (radiogroup 3 voies). ─────────────────
// `color-contrast` est DÉSACTIVÉ en vitest (L-016) → on valide ICI (app réelle, WCAG_TAGS) dans LES
// DEUX thèmes (motion-a11y §2). La voie carte est scannée à part (D5 ci-dessous) car elle introduit
// le bandeau « hors zone » + le bouton `.btn--outline`.
for (const theme of ['light', 'dark'] as const) {
  test(`Dimensionner (3 voies) : zéro violation axe (contraste inclus) — thème ${theme}`, async ({
    page,
  }) => {
    await forceTheme(page, theme);
    await mockApi(page);
    await page.goto('/mesurer');
    await expect(page.getByRole('heading', { level: 2, name: /dimensionner/i })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // Radiogroup des 3 voies rendu (voie véhicules par défaut). color-contrast inclus.
    await expect(page.getByRole('radiogroup', { name: /comment souhaitez-vous/i })).toBeVisible();
    const onDimension = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(onDimension.violations).toEqual([]);
  });
}

// ── EPIC 13 — CONTRASTE DUAL-THÈME de l'étape CONSEIL (ex-Résultats). ────────────────────────────
for (const theme of ['light', 'dark'] as const) {
  test(`Conseil : zéro violation axe (contraste inclus) — thème ${theme}`, async ({ page }) => {
    test.setTimeout(60000);
    await forceTheme(page, theme);
    await mockApi(page);
    await page.goto('/mesurer');

    await page.getByLabel(/berline/i).fill('1');
    await page.getByRole('button', { name: /calculer le gabarit/i }).click();
    await expect(page.getByRole('heading', { name: 'Abri double pointu 16 pi' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // color-contrast inclus (app réelle, WCAG_TAGS) sur l'étape Conseil, dans les deux thèmes.
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
}

// ── (c) VOIE `map` — smoke : @defer charge Leaflet, conteneur visible, axe (hors .leaflet-container). ─
test('voie « carte » smoke : @defer charge Leaflet, conteneur visible, axe (hors .leaflet-container)', async ({
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

  await page.goto('/mesurer');
  // Bascule en voie carte → la carte est montée derrière `@defer (on immediate)` (chargement sans scroll).
  await chooseVoie(page, /mesurer sur la carte/i);

  // BARRIÈRE déterministe (L-012) : on attend l'apparition du conteneur Leaflet, jamais un
  // waitForTimeout. geoman est importé AVANT `L.map(...)` (son init hook doit être posé avant la
  // construction de la carte — cf. `map-measure.ts`), donc le paint de la carte est gated sur le
  // chunk geoman (~360 kB). Timeout large (30 s) : 1er chargement des chunks Leaflet+geoman en CI.
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });

  // axe : on EXCLUT uniquement `.leaflet-container` (widget tiers Leaflet/geoman, mode
  // pointer-only documenté ; l'équivalent clavier complet est le calculateur de véhicules).
  // Tout le reste de la page (navbar, indicateur d'étapes, adresse, instructions) reste scanné.
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('.leaflet-container')
    .analyze();
  expect(results.violations).toEqual([]);
});

// ── (c) VOIE `map` — ASSERTION POSITIVE de DESSINABILITÉ (L-005/L-009) — capacité, pas l'enveloppe. ─
//
// « la carte s'affiche » (`.leaflet-container` visible) ne prouve PAS qu'elle est DESSINABLE : geoman
// s'attache à `map.pm` par EFFET DE BORD à l'import ; si cet attachement n'a pas lieu, la garde
// `if (!pm) return;` (map-measure.ts) saute silencieusement `pm.addControls` → AUCUNE barre d'outils,
// dessin désactivé, et le smoke test ci-dessus reste vert quand même. Ce test exige la barre geoman
// (`.leaflet-pm-toolbar.leaflet-pm-draw`) + un bouton de dessin (rectangle/polygone) → la carte EST
// dessinable (corrigé F2-D : geoman lit `globalThis.L`, exposé avant l'import — cf. `map-measure.ts`).
test('voie « carte » dessinable : barre d’outils geoman présente (capacité, L-019)', async ({
  page,
}) => {
  test.setTimeout(60000);
  await mockApi(page);
  await page.goto('/mesurer');
  await chooseVoie(page, /mesurer sur la carte/i);
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });

  // POSITIF : la barre de DESSIN geoman ET un bouton de dessin sont rendus → la carte est dessinable.
  // geoman ajoute deux `.leaflet-pm-toolbar` (dessin + édition) ; on cible la barre de DESSIN
  // (`.leaflet-pm-draw`) pour lever l'ambiguïté du mode strict tout en gardant l'assertion de CAPACITÉ.
  await expect(page.locator('.leaflet-pm-toolbar.leaflet-pm-draw')).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.locator('.leaflet-pm-icon-rectangle, .leaflet-pm-icon-polygon').first(),
  ).toBeVisible();

  // G3a — la zone de dessin est GÉNÉREUSE : elle sort du conteneur étroit (`.container--narrow`,
  // max 720px) en largeur ET offre une grande hauteur. On mesure le canvas réel : largeur > 720px
  // (donc le breakout fonctionne, pas juste un width:100% dans la colonne étroite) et hauteur
  // ample (≥ 28rem = 448px). Capacité réelle, pas l'enveloppe (L-019).
  const box = await page.locator('.map-measure__canvas').boundingBox();
  expect(box).not.toBeNull();
  // Viewport e2e par défaut (1280px) : le breakout (1100px) dépasse nettement la colonne 720px.
  expect(box!.width).toBeGreaterThan(720);
  expect(box!.height).toBeGreaterThanOrEqual(448);
});

// ── (c) VOIE `map` — D4 : CENTRAGE RÉEL de la carte sur l'adresse géocodée (capacité, L-019). ────
//
// L'adresse est renseignée SANS choisir de suggestion (saisie manuelle) : sans géocodage la carte
// se centrerait sur le repli Gatineau (bug D4). Désormais « Centrer la carte » géocode (réutilise
// `suggest`) et pose lat/lng. On mocke `suggest` avec des coordonnées CONNUES (≠ base Gatineau) puis
// on prouve, via `window.ng.getComponent()` sur `app-map-measure`, que les inputs lat/lng valent
// EXACTEMENT les valeurs géocodées — donc que la carte est centrée sur l'adresse, pas sur le repli.
test('voie « carte » D4 — la carte est CENTRÉE sur l’adresse géocodée (pas sur Gatineau)', async ({
  page,
}) => {
  test.setTimeout(60000);
  // Coordonnées en zone mais nettement distinctes de la base (45.4765/-75.7013).
  const GEO = { lat: 45.3201, lng: -75.8702 };
  await mockApi(page, [suggestion(GEO.lat, GEO.lng, 'Gatineau')]);
  await page.goto('/mesurer');
  await chooseVoie(page, /mesurer sur la carte/i);
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });

  // Renseigne l'adresse (sans suggestion) → géocodage (barrière réseau, L-012) → centrage.
  await fillMapAddress(page, 'Gatineau');

  // CAPACITÉ : on lit les inputs réels du composant carte servi (bundle courant, pas un zombie —
  // L-017). lat/lng DOIVENT être les valeurs géocodées, surtout PAS le repli Gatineau.
  await expect
    .poll(
      () =>
        page.locator('app-map-measure').evaluate((el) => {
          const cmp = (
            window as unknown as {
              ng: { getComponent(node: Element): { lat(): number | null } };
            }
          ).ng.getComponent(el);
          return cmp.lat();
        }),
      { timeout: 10000 },
    )
    .toBeCloseTo(GEO.lat, 4);

  const coords = await page.locator('app-map-measure').evaluate((el) => {
    const cmp = (
      window as unknown as {
        ng: { getComponent(node: Element): { lat(): number | null; lng(): number | null } };
      }
    ).ng.getComponent(el);
    return { lat: cmp.lat(), lng: cmp.lng() };
  });
  expect(coords.lat).toBeCloseTo(GEO.lat, 4);
  expect(coords.lng).toBeCloseTo(GEO.lng, 4);
  // Garde explicite anti-régression : ce n'est PAS le repli Gatineau (45.4765 / -75.7013).
  expect(coords.lat).not.toBeCloseTo(45.4765, 3);
});

// ── (c) VOIE `map` — D5 : AVERTISSEMENT « hors zone » (doux, NON bloquant) + CONTRASTE DUAL-THÈME. ─
//
// Adresse géocodée hors zone (Montréal ~160 km) → un `role="status"` informe l'utilisateur sans
// bloquer la mesure. Le bandeau « hors zone » (`--color-warning-solid`/`--color-bg-muted`) et le
// bouton `.btn--outline` introduisent des couleurs : `color-contrast` est DÉSACTIVÉ en vitest (L-016),
// donc on valide le contraste ICI (app réelle, `WCAG_TAGS` ⇒ règle incluse) dans LES DEUX thèmes
// (motion-a11y §2) — la voie carte n'étant pas couverte par le scan dual-thème de motion-a11y.spec.ts.
for (const theme of ['light', 'dark'] as const) {
  test(`voie « carte » D5 — hors zone : avertissement role="status", zéro axe contraste (${theme})`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await forceTheme(page, theme);
    // Montréal — hors zone de service.
    await mockApi(page, [suggestion(45.5019, -73.5674, 'Montréal')]);
    await page.goto('/mesurer');
    await chooseVoie(page, /mesurer sur la carte/i);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    // Renseigne l'adresse hors zone (sans suggestion) → géocodage → centrage + avertissement.
    await fillMapAddress(page, 'Montréal');

    // POSITIF (L-009) : l'avertissement « hors zone » est annoncé en role="status".
    const warning = page.getByText(/hors de notre zone/i);
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute('role', 'status');

    // CONTRASTE inclus (app réelle, WCAG_TAGS) sur la voie carte, où vivent le bandeau « hors zone »
    // et le bouton `.btn--outline` — color-contrast inclus, dans les deux thèmes (motion-a11y §2).
    // On exclut le widget tiers `.leaflet-container` (internes Leaflet/geoman, mode pointer-only).
    const onMap = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude('.leaflet-container')
      .analyze();
    expect(onMap.violations).toEqual([]);
  });
}
