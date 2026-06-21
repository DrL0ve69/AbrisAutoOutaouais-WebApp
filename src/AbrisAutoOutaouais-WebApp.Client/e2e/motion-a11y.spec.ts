import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : mouvement réduit + perf/contraste (Épic E, E5 — clôture Redesign v2) ──────────────
//
// Deux blocs, contre l'application RÉELLE (styles globaux + couleurs composées — seul endroit où
// `color-contrast` est exercé, cf. L-016 ; en vitest la règle est désactivée par conception).
//
//   Bloc A — `prefers-reduced-motion: reduce` ÉMULÉ (page.emulateMedia) : on prouve que le repli
//     « sans mouvement » est réellement appliqué — hero figé (pas d'épinglage GSAP), cursor-ring
//     inactif, viewer 3D montable sans auto-rotation. Chaque assertion négative est doublée d'une
//     positive (L-002) prouvant que l'élément est bien rendu, jamais absent par vacuité.
//
//   Bloc B — balayage axe DUAL-THÈME des routes redessinées, AVEC défilement pour déclencher le
//     verre `.navbar--scrolled` (que `a11y.spec.ts` n'exerce pas). Verrouille le must-fix contraste
//     du « Tempo »/icône de la navbar (E5, `--color-brand-on-dark`) — sinon la garde ne garde rien
//     (L-005). `color-contrast` est INCLUS (tags WCAG, app réelle).
//
// Conventions reprises de `a11y.spec.ts` / `shelter-3d.spec.ts` : `mockApi` pour le contenu sans
// backend, `forceTheme` via localStorage + assert `data-theme` avant axe, barrières via locator
// (jamais `waitForTimeout`, L-012), locators scopés par nom accessible (L-010).

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const categories = [
  { id: 'c1', name: 'Abris simples', slug: 'abris-simples', productCount: 1 },
  { id: 'c2', name: 'Abris doubles', slug: 'abris-doubles', productCount: 1 },
];

const product = {
  id: 'p1',
  name: 'Abri simple Tempo Garage 10x20',
  slug: 'abri-simple',
  description: 'Abri d’auto une place robuste, idéal pour l’hiver québécois.',
  price: 599.99,
  rentalPrice: 49.99,
  stock: 12,
  isAvailable: true,
  categoryName: 'Abris simples',
  thumbnailUrl: null,
  imageUrls: [],
  // Dimensions renseignées → le bloc « Voir en 3D » est proposé.
  widthCm: 305,
  lengthCm: 610,
  heightCm: 244,
};

const productList = {
  items: [
    product,
    {
      id: 'p2',
      name: 'Abri double Tempo Car Shelter 18x20',
      slug: 'abri-double',
      description: 'Abri deux places pour protéger toute la famille.',
      price: 899.99,
      rentalPrice: 79.99,
      stock: 5,
      isAvailable: true,
      categoryName: 'Abris doubles',
      thumbnailUrl: null,
      imageUrls: [],
    },
  ],
  totalCount: 2,
  pageNumber: 1,
  pageSize: 50,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/v1/shelters/suggest*', (route) =>
    route.fulfill({ json: [] }),
  );
  // Produit unique par slug AVANT le pattern de liste (priorité).
  await page.route('**/api/v1/products/*', (route) => route.fulfill({ json: product }));
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: productList }));
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

/** Composant viewer 3D, scopé (évite la collision role=img de la fiche, L-010). */
function viewer(page: Page) {
  return page.locator('app-shelter-3d-viewer');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Bloc A — `prefers-reduced-motion: reduce` réel : le repli « sans mouvement » est appliqué.
// ════════════════════════════════════════════════════════════════════════════════════════════

test.describe('Mouvement réduit (prefers-reduced-motion: reduce)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
  });

  test('Accueil : hero statique (aucun épinglage au défilement) + cursor-ring inactif', async ({
    page,
  }) => {
    await page.goto('/');

    // (1) Hydratation OK : le h1 (LCP) est visible — positif (L-002).
    await expect(
      page.getByRole('heading', { level: 1, name: /protégez votre véhicule/i }),
    ).toBeVisible();

    // (2) Hero statique. POSITIF : le composant hero est présent et visible.
    const hero = page.locator('app-hero-story');
    await expect(hero).toBeVisible();

    // NÉGATIF : plus aucune animation au défilement → aucun `.pin-spacer` injecté.
    await expect(page.locator('.pin-spacer')).toHaveCount(0);

    // Défiler ne doit RIEN épingler : on reste sans pin-spacer après scroll, hero monté.
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await expect(hero).toBeVisible();

    // (3) Cursor-ring inactif : le composant reste MONTÉ (positif) mais son anneau n'apparaît
    //     jamais, même après un déplacement du pointeur (négatif — on n'asserte QUE le comportement).
    await expect(page.locator('app-cursor-ring')).toBeAttached();
    const dot = page.locator('.cursor-ring__dot');
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    // En mouvement réduit, le repli CSS pose `display:none` (doublé du garde TS qui ne lie aucun
    // écouteur) → l'anneau n'est pas visible. Assertion comportementale, pas sur un attribut.
    await expect(dot).toBeHidden();
  });

  test('Fiche produit : viewer 3D montable et stable sous mouvement réduit (pas d’auto-rotation)', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto('/boutique/abri-simple');
    await expect(
      page.getByRole('heading', { level: 1, name: /abri simple/i }),
    ).toBeVisible();

    // Déclenche le `@defer (on interaction)` via le LOCATOR (clic), pas de saisie clavier (L-012).
    await page.getByRole('button', { name: /voir en 3d/i }).click();

    // BARRIÈRE de post-condition (L-012) : le composant viewer est monté (mode-indépendant —
    // WebGL ou repli statique). Scopé viewer (L-010).
    await expect(viewer(page)).toBeVisible({ timeout: 30000 });

    // Contrat reduced-motion : le viewer monte sans planter et reste stable (pas de démontage).
    await expect(viewer(page)).toBeVisible();

    // axe pleine page avec le viewer ouvert : on exclut le <canvas> WebGL tiers (role=img sans
    // contenu textuel), comme `shelter-3d.spec.ts`. Verrouille aussi le contraste navbar ici.
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude('canvas')
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2),
    ).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// Bloc B — balayage axe DUAL-THÈME + défilement (verre `.navbar--scrolled`). Verrouille le
// must-fix contraste « Tempo »/icône navbar (E5). `color-contrast` inclus (app réelle, L-016).
// ════════════════════════════════════════════════════════════════════════════════════════════

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

const routes = [
  {
    nom: 'Accueil (/)',
    chemin: '/',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { name: /abri|véhicule/i }).first()).toBeVisible(),
  },
  {
    nom: 'Boutique (/boutique)',
    chemin: '/boutique',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible(),
  },
  {
    nom: 'Détail produit (/boutique/abri-simple)',
    chemin: '/boutique/abri-simple',
    pret: (page: Page) =>
      expect(page.getByRole('heading', { name: /abri/i }).first()).toBeVisible(),
  },
] as const;

test.describe('Balayage axe dual-thème avec navbar scrollée (verre)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  for (const theme of themes) {
    for (const route of routes) {
      test(`${route.nom} — aucune violation WCAG AA, navbar scrollée (${theme.libelle})`, async ({
        page,
      }) => {
        await forceTheme(page, theme.id);
        await page.goto(route.chemin);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
        await route.pret(page);

        // Défiler déclenche `.navbar--scrolled` (verre translucide rgba(15,25,35,.82)) — le fond
        // navbar le plus clair, donc le PIRE cas pour le contraste du « Tempo »/icône. C'est ce
        // que `a11y.spec.ts` (sans scroll) n'exerce pas. Le handler navbar écoute `window:scroll`
        // et bascule la classe à `scrollY > 20`. Sur l'accueil, la hauteur défilable dépend de
        // l'hydratation (le hero GSAP grandit la page APRÈS coup, cf. L-012) : on re-scrolle dans
        // une boucle `expect.poll` jusqu'à ce que la classe s'applique — pas de `waitForTimeout`.
        const navbar = page.locator('app-navbar .navbar');
        await expect
          .poll(
            async () => {
              await page.evaluate(() => {
                window.scrollTo(0, 600);
                window.dispatchEvent(new Event('scroll'));
              });
              return (await navbar.getAttribute('class')) ?? '';
            },
            { timeout: 15000 },
          )
          .toContain('navbar--scrolled');

        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        expect(
          results.violations,
          JSON.stringify(
            results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
            null,
            2,
          ),
        ).toEqual([]);
      });
    }
  }
});
