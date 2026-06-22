import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : suivi de PAIE INFORMATIVE admin (EPIC 8, US-8.1).
// Vérifie dans un VRAI navigateur : récap chargé, édition inline du taux (PUT + focus), action
// « Marquer payé » (PUT mark-paid avec barrière réseau), navigation clavier du tableau, et balayage
// axe WCAG AA dans LES DEUX thèmes. État admin simulé via localStorage + page.route.

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

const SUMMARY = {
  from: '2026-07-01',
  to: '2026-07-31',
  totalPayroll: 180,
  employees: [
    {
      employeeId: 'emp-1',
      fullName: 'Alice Tremblay',
      hourlyRate: 20,
      totalMinutes: 540,
      amount: 180,
      payStatus: 'AnsPayer',
      entryCount: 1,
      unpaidCount: 1,
    },
    {
      employeeId: 'emp-2',
      fullName: 'Bob Gagnon',
      hourlyRate: null,
      totalMinutes: 600,
      amount: null,
      payStatus: 'Payee',
      entryCount: 1,
      unpaidCount: 0,
    },
  ],
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
  // Récap de paie — par défaut renvoie SUMMARY (les tests qui veulent intercepter un PUT
  // surchargent cette route après navigation).
  await page.route('**/api/v1/payroll/summary**', (route) => route.fulfill({ json: SUMMARY }));
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
 * On charge « / » (hydratation → authentifié côté client) puis on navigue DANS le SPA pour que les
 * gardes s'exécutent côté navigateur (même approche qu'admin-shelter-models.spec.ts).
 */
async function gotoPayrollAdmin(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: /administration/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: 'Employés & paie', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/paie$/);
  await expect(page.getByRole('rowheader', { name: 'Alice Tremblay' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test('Paie admin — affiche le récap, le total et les statuts', async ({ page }) => {
  await gotoPayrollAdmin(page);

  await expect(page.getByRole('rowheader', { name: 'Bob Gagnon' })).toBeVisible();
  // Bob sans taux : « taux non défini » + montant indisponible.
  await expect(page.getByText('taux non défini')).toBeVisible();
  await expect(page.getByText('À payer')).toBeVisible();
  await expect(page.getByText('Payée')).toBeVisible();
});

test('Paie admin — éditer le taux focalise le champ puis envoie PUT', async ({ page }) => {
  await gotoPayrollAdmin(page);

  await page.getByRole('button', { name: /Modifier le taux horaire de Alice/i }).click();

  // Le champ de saisie reçoit le focus (L-006).
  const input = page.getByLabel('Taux horaire en dollars');
  await expect(input).toBeFocused();
  await input.fill('25');

  const putReq = page.waitForRequest(
    (req: Request) =>
      /\/api\/v1\/payroll\/employees\/emp-1\/rate$/.test(req.url()) &&
      req.method() === 'PUT' &&
      req.postDataJSON()?.hourlyRate === 25,
  );
  await page.route('**/api/v1/payroll/employees/emp-1/rate', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await putReq;
});

test('Paie admin — « Marquer payé » envoie PUT mark-paid (barrière réseau)', async ({ page }) => {
  await gotoPayrollAdmin(page);

  await page.route('**/api/v1/payroll/mark-paid', (route, request) => {
    if (request.method() === 'PUT') {
      route.fulfill({ json: { updated: 1 } });
    } else {
      route.continue();
    }
  });
  // Après le marquage, le récap rechargé montre Alice « Payée » → son bouton « Marquer payé »
  // disparaît, ce qui exerce le repli de focus sur le bouton « Taux » (L-006).
  const SUMMARY_AFTER = {
    ...SUMMARY,
    employees: [
      { ...SUMMARY.employees[0], payStatus: 'Payee', unpaidCount: 0 },
      SUMMARY.employees[1],
    ],
  };
  await page.route('**/api/v1/payroll/summary**', (route) => route.fulfill({ json: SUMMARY_AFTER }));

  const markResp = page.waitForResponse(/payroll\/mark-paid/);
  await page.getByRole('button', { name: /Marquer la paie de Alice/i }).click();
  const resp = await markResp;
  const body = await resp.json();
  expect(body.updated).toBe(1);

  // Rechargement déclenché : nouveau GET summary.
  await page.waitForResponse(/payroll\/summary/);

  // Le bouton « Marquer payé » disparaît (Alice passe à « Payée » dans la fixture rechargée),
  // donc le focus est redirigé sur son bouton « Taux » — jamais perdu sur <body> (L-006).
  await expect(page.locator('#rate-trigger-emp-1')).toBeFocused();
});

test('Paie admin — navigation clavier : Tab atteint les actions du tableau', async ({ page }) => {
  await gotoPayrollAdmin(page);

  // Le bouton « Taux » d'Alice est focalisable au clavier.
  const rateBtn = page.getByRole('button', { name: /Modifier le taux horaire de Alice/i });
  await rateBtn.focus();
  await expect(rateBtn).toBeFocused();
  // Tab avance vers l'action suivante (« Marquer payé » d'Alice).
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Marquer la paie de Alice/i })).toBeFocused();
});

// ── Balayage axe : page admin × deux thèmes ─────────────────────────────────
const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

for (const theme of themes) {
  test(`Paie admin — aucune violation WCAG AA (${theme.libelle})`, async ({ page }) => {
    await forceTheme(page, theme.id);
    await gotoPayrollAdmin(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

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
