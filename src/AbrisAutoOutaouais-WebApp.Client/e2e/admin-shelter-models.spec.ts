import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : administration du référentiel de modèles d'abris (EPIC 9.5).
// Vérifie dans un VRAI navigateur : parcours admin create → edit (slug immuable) → delete
// avec les vraies requêtes HTTP simulées, et balayage axe WCAG AA de la page dans LES DEUX
// thèmes (l'état admin authentifié est simulé via localStorage + page.route, comme
// admin-management.spec.ts). API simulée via page.route.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const ADMIN_USER = {
  id: '99999999-9999-9999-9999-999999999999',
  email: 'admin@abrisauto.com',
  username: 'admin',
  firstName: 'Alice',
  lastName: 'Admin',
  roles: ['Admin'],
  avatar: null,
};

const CATEGORIES = [
  { id: 'cat-1', name: 'Abris simples', slug: 'abris-simples', productCount: 0 },
];

const MODELS = [
  {
    id: 'm-1',
    slug: 'abri-simple',
    name: 'Abri simple',
    categoryName: 'Abris simples',
    basePrice: 349,
    minLengthCm: 122,
    maxLengthCm: 1830,
    lengthStepCm: 122,
  },
];

const MODEL_DETAIL = {
  ...MODELS[0],
  // Le détail porte le categoryId (Guid) : l'édition résout la catégorie PAR ID, pas par nom.
  categoryId: 'cat-1',
  pricePerArchCents: 15000,
  widthOptionsCm: [335, 366],
  clearHeightOptionsCm: [198],
};

async function signInAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(
    (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user);
    },
    { token: 'e2e.fake.jwt', user: JSON.stringify(ADMIN_USER) },
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...ADMIN_USER, defaultDeliveryAddress: null, preferredLanguage: 'fr' } }),
  );
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: CATEGORIES }));
  // Liste des modèles (GET sans paramètre de détail).
  await page.route('**/api/v1/shelters', (route) => route.fulfill({ json: MODELS }));
  // Détail par slug (chargé à l'édition).
  await page.route('**/api/v1/shelters/abri-simple', (route) =>
    route.fulfill({ json: MODEL_DETAIL }),
  );
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

/**
 * /admin/* est protégé par authGuard + adminGuard ; en SSR le serveur n'a pas le localStorage.
 * On charge « / » (hydratation → authentifié côté client), puis on navigue DANS le SPA via le
 * lien « Administration » et la carte du tableau de bord, pour que les gardes s'exécutent côté
 * navigateur (même approche qu'admin-management.spec.ts).
 */
async function gotoShelterModelsAdmin(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: /administration/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: "Modèles d'abris", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/modeles-abris$/);
}

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test("Référentiel admin — créer un modèle envoie POST /shelters", async ({ page }) => {
  await gotoShelterModelsAdmin(page);
  await expect(page.getByRole('rowheader', { name: 'Abri simple' })).toBeVisible();

  await page.getByLabel(/identifiant \(slug\)/i).fill('abri-tempo');
  await page.getByLabel(/^nom$/i).fill('Abri Tempo');
  await page.getByLabel(/catégorie/i).selectOption('cat-1');
  await page.getByLabel(/prix de base/i).fill('349');
  await page.getByLabel(/prix par arche/i).fill('15000');
  await page.getByLabel(/largeurs proposées/i).fill('244, 305, 366');
  await page.getByLabel(/hauteurs dégagées/i).fill('198, 213');

  const postReq = page.waitForRequest(
    (req: Request) =>
      /\/api\/v1\/shelters$/.test(req.url()) &&
      req.method() === 'POST' &&
      req.postDataJSON()?.slug === 'abri-tempo',
  );
  await page.route('**/api/v1/shelters', async (route, request) => {
    if (request.method() === 'POST') {
      await route.fulfill({ status: 201, json: { id: 'new-id' } });
    } else {
      await route.fulfill({ json: MODELS });
    }
  });
  await page.getByRole('button', { name: /créer le modèle/i }).click();
  await postReq;
});

test("Référentiel admin — éditer affiche le slug en lecture seule et envoie PUT sans slug", async ({
  page,
}) => {
  await gotoShelterModelsAdmin(page);
  await page.getByRole('button', { name: /modifier abri simple/i }).click();

  // Slug en lecture seule : pas de champ de saisie, valeur affichée en texte.
  await expect(page.getByLabel(/identifiant \(slug\)/i)).toHaveCount(0);
  await expect(page.getByText('abri-simple', { exact: true })).toBeVisible();

  const putReq = page.waitForRequest(
    (req: Request) =>
      /\/api\/v1\/shelters\/m-1$/.test(req.url()) &&
      req.method() === 'PUT' &&
      req.postDataJSON()?.slug === undefined,
  );
  await page.route('**/api/v1/shelters/m-1', (route) => route.fulfill({ status: 204, body: '' }));
  await page.getByRole('button', { name: /enregistrer/i }).click();
  await putReq;
});

test("Référentiel admin — supprimer ouvre l'alertdialog focalisé puis envoie DELETE", async ({
  page,
}) => {
  await gotoShelterModelsAdmin(page);

  const trigger = page.getByRole('button', { name: /supprimer abri simple/i });
  await trigger.press('Enter');

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  const deleteReq = page.waitForRequest(
    (req: Request) => /\/api\/v1\/shelters\/m-1$/.test(req.url()) && req.method() === 'DELETE',
  );
  await page.route('**/api/v1/shelters/m-1', (route) => route.fulfill({ status: 204, body: '' }));
  await dialog.getByRole('button', { name: /^supprimer$/i }).click();
  await deleteReq;

  // Le titre de la liste reçoit le focus après suppression (L-006).
  await expect(page.getByRole('heading', { name: /modèles du référentiel/i })).toBeFocused();
});

// ── Balayage axe : page admin × deux thèmes ─────────────────────────────────
const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

for (const theme of themes) {
  test(`Référentiel admin — aucune violation WCAG AA (${theme.libelle})`, async ({ page }) => {
    await forceTheme(page, theme.id);
    await gotoShelterModelsAdmin(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    await expect(page.getByRole('rowheader', { name: 'Abri simple' })).toBeVisible();

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
