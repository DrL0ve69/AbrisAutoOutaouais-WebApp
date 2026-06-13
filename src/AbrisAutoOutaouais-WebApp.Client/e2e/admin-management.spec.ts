import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : pages d'administration B3 (réservations, locations, utilisateurs).
// Vérifie dans un VRAI navigateur : parcours CLAVIER complet d'une transition de
// statut (Enter ouvre l'alertdialog focalisé, Échap rend le focus, Tab + Enter
// confirme → POST /bookings/{id}/status), et balayage axe WCAG AA des trois pages
// dans LES DEUX thèmes (le balayage a11y.spec.ts ne couvre que des routes
// publiques — l'état admin authentifié est simulé ici). API simulée via page.route.

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

const BOOKINGS = [
  {
    id: 'b1',
    customerName: 'Camille Client',
    customerEmail: 'camille@test.com',
    slotStart: '2026-07-06T12:00:00Z',
    slotEnd: '2026-07-06T14:00:00Z',
    type: 'Installation',
    status: 'Pending',
    addressSummary: '123 rue des Érables, Gatineau',
    createdAt: '2026-06-01T15:00:00Z',
  },
  {
    id: 'b2',
    customerName: 'Benoît Acheteur',
    customerEmail: 'benoit@test.com',
    slotStart: '2026-07-07T14:00:00Z',
    slotEnd: '2026-07-07T16:00:00Z',
    type: 'Removal',
    status: 'Completed',
    addressSummary: '45 boulevard du Plateau, Hull',
    createdAt: '2026-06-02T15:00:00Z',
  },
];

const RENTALS = [
  {
    id: 'r1',
    customerName: 'Camille Client',
    customerEmail: 'camille@test.com',
    productName: 'Abri simple Tempo',
    monthlyRate: 49,
    startDate: '2026-07-01',
    endDate: '2026-10-01',
    status: 'Active',
    addressSummary: '123 rue des Érables, Gatineau',
    createdAt: '2026-06-01T15:00:00Z',
  },
];

const USERS = [
  {
    id: 'u1',
    email: 'admin@abrisauto.com',
    username: 'admin',
    fullName: 'Alice Admin',
    roles: ['Admin'],
    createdAt: '2026-01-15T10:00:00Z',
    isLockedOut: false,
  },
  {
    id: 'u2',
    email: 'camille@test.com',
    username: 'camille',
    fullName: 'Camille Client',
    roles: ['Customer'],
    createdAt: '2026-03-20T10:00:00Z',
    isLockedOut: true,
  },
];

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
  await page.route('**/api/v1/bookings/all', (route) => route.fulfill({ json: BOOKINGS }));
  await page.route('**/api/v1/rentals/all', (route) => route.fulfill({ json: RENTALS }));
  await page.route('**/api/v1/users', (route) => route.fulfill({ json: USERS }));
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
 * /admin/* est protégé par authGuard + adminGuard. En SSR le serveur n'a pas le
 * localStorage, donc un goto direct redirige. On charge la page publique « / »
 * (qui s'hydrate et devient authentifiée côté client) puis on navigue DANS le SPA
 * via le lien « Administration » de la barre de navigation et la carte du tableau
 * de bord, pour que les gardes s'exécutent côté navigateur.
 */
async function gotoAdminPage(page: Page, tileName: string, urlRe: RegExp): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: /administration/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.getByRole('link', { name: tileName, exact: true }).click();
  await expect(page).toHaveURL(urlRe);
}

test.beforeEach(async ({ page }) => {
  await signInAsAdmin(page);
});

test('Réservations admin — transition de statut entièrement au clavier (focus + POST /status)', async ({
  page,
}) => {
  await gotoAdminPage(page, 'Réservations', /\/admin\/reservations$/);

  // La réservation en attente expose ses actions ; la complétée n'en a aucune.
  await expect(page.getByText('Camille Client')).toBeVisible();
  const confirmBtn = page.getByRole('button', { name: /confirmer — camille client/i });
  await expect(confirmBtn).toBeVisible();

  // Enter (clavier) ouvre la confirmation → alertdialog visible et focalisé.
  await confirmBtn.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  // Échap referme et rend le focus au bouton déclencheur (WCAG 2.4.3).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(confirmBtn).toBeFocused();

  // Ré-ouvre au clavier, Tab → « Confirmer l'action », Enter → POST réel.
  await confirmBtn.press('Enter');
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /confirmer l.action/i })).toBeFocused();

  const statusRequest = page.waitForRequest(
    (req: Request) =>
      /\/api\/v1\/bookings\/b1\/status$/.test(req.url()) &&
      req.method() === 'POST' &&
      req.postDataJSON()?.action === 'confirm',
  );
  await page.route('**/api/v1/bookings/*/status', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await page.keyboard.press('Enter');
  await statusRequest;

  // La ligne passe à « Confirmée » : nouvelle action « Marquer complétée »,
  // l'ancien déclencheur disparaît et le focus revient sur le titre (L-006).
  await expect(
    page.getByRole('button', { name: /marquer complétée — camille client/i }),
  ).toBeVisible();
  await expect(confirmBtn).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /gestion des réservations/i })).toBeFocused();
});

// ── Balayage axe paramétré : trois pages admin × deux thèmes ────────────────
const adminRoutes = [
  {
    nom: 'Réservations (/admin/reservations)',
    tuile: 'Réservations',
    url: /\/admin\/reservations$/,
    pret: (page: Page) => expect(page.getByText('Camille Client')).toBeVisible(),
  },
  {
    nom: 'Locations (/admin/locations)',
    tuile: 'Locations',
    url: /\/admin\/locations$/,
    pret: (page: Page) => expect(page.getByText('Abri simple Tempo')).toBeVisible(),
  },
  {
    nom: 'Utilisateurs (/admin/utilisateurs)',
    tuile: 'Utilisateurs',
    url: /\/admin\/utilisateurs$/,
    // « Alice Admin » apparaît aussi dans le menu utilisateur de la navbar →
    // on cible l'en-tête de ligne de la table.
    pret: (page: Page) =>
      expect(page.getByRole('rowheader', { name: 'Alice Admin' })).toBeVisible(),
  },
] as const;

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

for (const theme of themes) {
  for (const route of adminRoutes) {
    test(`${route.nom} — aucune violation WCAG AA (${theme.libelle})`, async ({ page }) => {
      await forceTheme(page, theme.id);
      await gotoAdminPage(page, route.tuile, route.url);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
      await route.pret(page);

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
