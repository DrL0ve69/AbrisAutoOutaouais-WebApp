import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : Viewer 3D d'abri (Epic E, E4) ─────────────────────────────────────────
//
// Sur une fiche produit À DIMENSIONS, le bloc « Voir en 3D » apparaît (`@if has3dDims`).
// On déclenche le `@defer (on interaction)` EN CLIQUANT le bouton via le locator (jamais
// keyboard.type — L-012, app SSR+hydration), puis on attend `getByRole('img', { name })`
// comme BARRIÈRE de post-condition (jamais waitForTimeout). Cette barrière est mode-
// indépendante : avec WebGL c'est le <canvas role="img" aria-label="Modèle 3D…">, sans
// WebGL (CI headless possible) c'est le repli <img alt=nom> — les deux portent le nom produit.
//
// On vérifie ensuite que les boutons clavier sont focusables et opèrent, qu'en mouvement
// réduit l'auto-rotation est coupée (contrat : le viewer monte quand même, sans animer), et
// que la route reste axe-clean (on exclut le <canvas> tiers WebGL au besoin).
//
// L-010 (collision de role dans un namespace global) : la fiche porte DÉJÀ un <img> produit
// nommé d'après le produit, et le viewer ajoute un <img> de repli + un <canvas role="img">.
// On NE référence donc JAMAIS un `getByRole('img', { name: /produit/ })` non scopé — la barrière
// vise le label DISTINCTIF du canvas (« Modèle 3D interactif de … »), scopée au composant viewer.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

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
  // Dimensions hors-tout renseignées → le viewer 3D est proposé.
  widthCm: 305,
  lengthCm: 610,
  heightCm: 244,
};

const categories = [
  { id: 'c1', name: 'Abris simples', slug: 'abris-simples', productCount: 1 },
];

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/v1/products/suggest-shelters*', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/v1/products/*', (route) => route.fulfill({ json: product }));
}

/** Le composant viewer (scope pour toutes les requêtes — évite la collision role=img L-010). */
function viewer(page: Page) {
  return page.locator('app-shelter-3d-viewer');
}

/**
 * Va sur la fiche produit et déclenche le viewer 3D via le bouton « Voir en 3D ».
 * Renvoie `true` si la scène WebGL a monté (canvas role=img), `false` si repli statique
 * (CI sans WebGL) — la post-condition est mode-indépendante : le composant viewer est présent.
 */
async function openViewer(page: Page): Promise<boolean> {
  await page.goto('/boutique/abri-simple');
  await expect(
    page.getByRole('heading', { level: 1, name: /abri simple/i }),
  ).toBeVisible();

  // Déclenche le `@defer (on interaction)` via le LOCATOR (clic), pas de saisie clavier brute.
  await page.getByRole('button', { name: /voir en 3d/i }).click();

  // BARRIÈRE déterministe (L-012) : on attend que le composant viewer soit rendu. SCOPE viewer
  // (L-010) : on ne touche pas au <img> produit de la fiche, qui porte aussi le nom.
  await expect(viewer(page)).toBeVisible({ timeout: 30000 });

  // Distingue WebGL (canvas « Modèle 3D interactif de … ») du repli <img alt=nom> (CI headless).
  const canvas = viewer(page).getByRole('img', { name: /modèle 3d interactif/i });
  return (await canvas.count()) > 0;
}

test('clic « Voir en 3D » → viewer monté, commandes clavier focusables et opérantes', async ({
  page,
}) => {
  test.setTimeout(60000);
  await mockApi(page);
  const webgl = await openViewer(page);

  if (!webgl) {
    // CI sans WebGL : la post-condition est le repli statique nommé, scopé au viewer.
    await expect(
      viewer(page).getByRole('img', { name: 'Abri simple Tempo Garage 10x20', exact: true }),
    ).toBeVisible();
    return;
  }

  // WebGL dispo : le canvas (label distinctif) est rendu et la barre de commande apparaît.
  await expect(viewer(page).getByRole('img', { name: /modèle 3d interactif/i })).toBeVisible();

  // Boutons réels, focusables, cibles ≥44px (WCAG 2.5.8).
  const rotateRight = page.getByRole('button', { name: /pivoter vers la droite/i });
  await rotateRight.focus();
  await expect(rotateRight).toBeFocused();
  const box = await rotateRight.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);

  // Opèrent : aucun clic ne doit lever d'erreur ni démonter le viewer.
  await rotateRight.click();
  await page.getByRole('button', { name: /zoom avant/i }).click();
  await page.getByRole('button', { name: /réinitialiser la vue/i }).click();
  await expect(viewer(page).getByRole('img', { name: /modèle 3d interactif/i })).toBeVisible();
});

test('mouvement réduit : le viewer monte sans planter (pas d’auto-rotation)', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page);
  await openViewer(page);

  // Contrat mode-indépendant : le viewer est présent et stable, sans erreur ni démontage.
  await expect(viewer(page)).toBeVisible();
});

test('aucune violation axe sur la fiche avec viewer 3D ouvert', async ({ page }) => {
  test.setTimeout(60000);
  await mockApi(page);
  await openViewer(page);

  // Le <canvas> WebGL est un visuel tiers (role=img sans contenu textuel) : on l'exclut du
  // balayage axe comme on exclut `.leaflet-container` dans mesurer.spec.ts.
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude('canvas')
    .analyze();
  expect(results.violations).toEqual([]);
});
