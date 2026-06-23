import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e (EPIC 7.2) : réconciliation administrative d'un paiement de LOCATION par virement Interac.
// Un admin ouvre /admin/locations : le contrat en attente de paiement affiche sa référence de
// virement et un bouton « Marquer payé ». Le clic appelle POST /rentals/{id}/confirm-payment (204) ;
// après rechargement, le contrat montre le badge « Payé » + date et le bouton disparaît. La page est
// balayée par axe dans LES DEUX thèmes (contraste non couvert en vitest — L-016 ; vit en e2e — L-005).
//
// /admin/* est protégé (authGuard + adminGuard) : en SSR le serveur n'a pas le localStorage, donc on
// part de « / » (hydratée → authentifiée côté client) puis on navigue DANS le SPA (idiome
// admin-management.spec.ts). API simulée via page.route.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const ADMIN_USER = {
  id: '99999999-9999-9999-9999-999999999999',
  email: 'admin@abrisauto.com',
  username: 'admin',
  firstName: 'Alice',
  lastName: 'Admin',
  roles: ['Admin'],
  avatar: null,
};

const AWAITING = {
  id: 'r1',
  customerName: 'Camille Client',
  customerEmail: 'camille@test.com',
  productName: 'Abri simple Tempo',
  monthlyRate: 89,
  startDate: '2026-07-01',
  endDate: '2026-10-01',
  status: 'PendingPayment',
  addressSummary: '123 rue des Érables, Gatineau',
  createdAt: '2026-06-01T15:00:00Z',
  paymentReference: 'INT-AB12-CD34',
  paymentConfirmedAt: null,
};

const PAID_AFTER_RELOAD = {
  ...AWAITING,
  id: 'r2',
  customerName: 'Benoît Acheteur',
  customerEmail: 'benoit@test.com',
  paymentReference: 'INT-EF56-GH78', // référence distincte → pas d'ambiguïté de locator
  status: 'Active',
  paymentConfirmedAt: '2026-06-03T09:00:00Z',
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
}

async function gotoAdminRentals(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: /administration/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: 'Locations', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/locations$/);
}

test('Admin locations — « Marquer payé » → POST confirm-payment puis statut payé', async ({
  page,
}) => {
  await signInAsAdmin(page);

  // 1er chargement : contrat en attente de paiement. Après confirm, le rechargement renvoie le payé.
  let loaded = 0;
  await page.route('**/api/v1/rentals/all', (route) => {
    loaded += 1;
    route.fulfill({ json: loaded === 1 ? [AWAITING] : [PAID_AFTER_RELOAD] });
  });

  await gotoAdminRentals(page);

  // Référence de virement + bouton « Marquer payé » étiqueté avec la référence du virement (L-024).
  await expect(page.getByText('INT-AB12-CD34')).toBeVisible();
  const markPaid = page.getByRole('button', { name: /marquer payé — int-ab12-cd34/i });
  await expect(markPaid).toBeVisible();

  // Clic → POST /rentals/r1/confirm-payment (204).
  const confirmRequest = page.waitForRequest(
    (req: Request) =>
      /\/api\/v1\/rentals\/r1\/confirm-payment$/.test(req.url()) && req.method() === 'POST',
  );
  await page.route('**/api/v1/rentals/*/confirm-payment', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await markPaid.click();
  await confirmRequest;

  // Après rechargement : badge « Payé » présent, bouton « Marquer payé » disparu, focus au titre (L-006).
  await expect(page.getByText(/^payé$/i)).toBeVisible();
  await expect(markPaid).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /gestion des locations/i })).toBeFocused();
});

for (const theme of themes) {
  test(`Admin locations — colonne paiement accessible (axe) — ${theme.libelle}`, async ({
    page,
  }) => {
    await forceTheme(page, theme.id);
    await signInAsAdmin(page);
    await page.route('**/api/v1/rentals/all', (route) =>
      route.fulfill({ json: [AWAITING, PAID_AFTER_RELOAD] }),
    );

    await gotoAdminRentals(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    await expect(page.getByText('INT-AB12-CD34')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations,
      `Violations axe (${theme.libelle}) : ${results.violations.map((v) => v.id).join(', ')}`,
    ).toEqual([]);
  });
}
