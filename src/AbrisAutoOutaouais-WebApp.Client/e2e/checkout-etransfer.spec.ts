import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e (EPIC 7) : tunnel de commande COMPLET avec paiement par VIREMENT INTERAC (e-Transfer).
// Un client CONNECTÉ (pas de bloc « coordonnées invité » à remplir) ajoute un produit, atteint la
// caisse, passe la commande (réception « Ramassage » → aucune adresse requise) et aboutit sur le
// panneau d'instructions Interac qui affiche reference / recipientEmail / amount. AUCUNE redirection
// automatique (le client doit exécuter le virement). Le panneau est balayé par axe dans LES DEUX
// thèmes (contraste non couvert en vitest — L-016 ; le balayage doit donc vivre en e2e — L-005).
// Non-vacuité : sur un revert (panneau absent), le `getByRole('heading', …)` échoue → la garde mord.
//
// L'API est simulée via page.route. SSR + hydratation : on capte le POST via barrière réseau
// `waitForResponse` (pas de waitForTimeout — L-012).

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const AUTH_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'client@test.com',
  username: 'client',
  firstName: 'Camille',
  lastName: 'Client',
  roles: ['Customer'],
  avatar: null,
};

const PRODUCTS = {
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

const PAYMENT = {
  reference: 'CMD-ETR-7777',
  recipientEmail: 'paiements@abristempo.ca',
  amount: 599.99,
  instructions:
    'Ouvrez votre application bancaire, choisissez « Virement Interac » et inscrivez la référence dans le message.',
};

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user);
    },
    { token: 'e2e.fake.jwt', user: JSON.stringify(AUTH_USER) },
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...AUTH_USER, defaultDeliveryAddress: null, preferredLanguage: 'fr' } }),
  );
}

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: PRODUCTS }));
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/orders/mine', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/orders', (route) =>
    route.fulfill({ status: 201, json: { id: 'order-etr', payment: PAYMENT } }),
  );
}

/** Ajoute un produit au panier puis atteint la caisse, en restant DANS le SPA (panier en mémoire). */
async function reachCheckout(page: Page): Promise<void> {
  await page.goto('/boutique');
  await page.getByRole('button', { name: 'Ajouter au panier' }).first().click();
  await page.getByRole('link', { name: /panier/i }).first().click();
  await expect(page).toHaveURL(/\/panier$/);
  await page.getByRole('button', { name: /passer à la caisse/i }).click();
  await expect(page).toHaveURL(/\/panier\/caisse$/);
}

for (const theme of themes) {
  test(`Caisse → virement Interac : panneau d'instructions affiché et accessible — ${theme.libelle}`, async ({
    page,
  }) => {
    await forceTheme(page, theme.id);
    await signIn(page);
    await mockApi(page);
    await reachCheckout(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // Réception « Ramassage » (par défaut) → aucune adresse requise. On passe la commande.
    const orderResponse = page.waitForResponse(
      (resp) => resp.url().endsWith('/api/v1/orders') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /passer la commande/i }).click();
    await orderResponse;

    // Panneau e-Transfer : titre focalisé (L-006) + les trois informations clés.
    const heading = page.getByRole('heading', {
      name: /réglez votre commande par virement interac/i,
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(PAYMENT.reference)).toBeVisible();
    await expect(page.getByText(PAYMENT.recipientEmail)).toBeVisible();
    // Montant (599,99 $ en fr-CA) présent.
    await expect(page.getByText(/599[.,]99/)).toBeVisible();
    // Aucune mention « démo » / « carte » ne subsiste.
    await expect(page.getByText(/démonstration/i)).toHaveCount(0);

    // Balayage axe du panneau d'instructions (contraste inclus, dual-thème — L-016).
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations,
      `Violations axe (${theme.libelle}) : ${results.violations.map((v) => v.id).join(', ')}`,
    ).toEqual([]);
  });
}
