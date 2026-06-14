import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : report d'une réservation depuis « Mes réservations » (/mon-compte/reservations).
// Vérifie dans un VRAI navigateur : rendu accessible (axe), ouverture d'une boîte de dialogue
// (role="alertdialog") qui capture le focus, choix d'un créneau, appel réel
// POST /api/v1/bookings/{id}/reschedule, et retour du focus au déclencheur via Échap (2.4.3).
// API simulée via page.route.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const AUTH_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'client@test.com',
  username: 'client',
  firstName: 'Camille',
  lastName: 'Client',
  roles: ['Customer'],
  avatar: null,
};

const BOOKING = {
  id: 'b1',
  slotStart: '2026-06-15T14:00:00Z',
  durationMin: 120,
  type: 'Installation',
  status: 'Confirmed',
  city: 'Gatineau',
};

const SLOTS = [
  { start: '2026-06-16T10:00:00Z', end: '2026-06-16T12:00:00Z' },
  { start: '2026-06-16T12:00:00Z', end: '2026-06-16T14:00:00Z' },
];

async function signInWithBooking(page: Page): Promise<void> {
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
  await page.route('**/api/v1/bookings/mine', (route) => route.fulfill({ json: [BOOKING] }));
  await page.route('**/api/v1/bookings/available-slots*', (route) => route.fulfill({ json: SLOTS }));
}

test.beforeEach(async ({ page }) => {
  await signInWithBooking(page);
});

test('Mes réservations — report accessible (focus + POST /reschedule)', async ({ page }) => {
  // /mon-compte/* est protégé par authGuard ; en SSR le serveur n'a pas le localStorage et
  // redirige. On charge une page publique (hydratation → authentifié côté client) puis on
  // navigue DANS le SPA jusqu'à la page protégée.
  await page.goto('/');
  await page.getByRole('button', { name: /menu de/i }).click();
  await page.getByRole('menuitem', { name: /mes réservations/i }).click();
  await expect(page).toHaveURL(/\/mon-compte\/reservations$/);

  await expect(page.getByText(/Gatineau/)).toBeVisible();
  const reporter = page.getByRole('button', { name: /reporter la réservation/i });
  await expect(reporter).toBeVisible();

  // a11y PLEINE PAGE (navbar authentifiée incluse) : le contraste de la navbar est corrigé
  // (E5, must-fix « Tempo »/icône → --color-brand-on-dark) ; plus d'exclusion app-reservations (L-008).
  let results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);

  // Ouvre le dialogue → alertdialog visible et focus capturé.
  await reporter.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  // a11y PLEINE PAGE avec le dialogue (et le radiogroup des créneaux) ouvert.
  results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);

  // Échap referme et rend le focus au déclencheur (WCAG 2.4.3).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(reporter).toBeFocused();

  // Ré-ouvre, choisit le 1er créneau, confirme → POST /reschedule envoyé avec le bon créneau.
  await reporter.click();
  await page.locator('label.reschedule__slot').first().click();

  const rescheduleRequest = page.waitForRequest(
    (req: Request) =>
      /\/api\/v1\/bookings\/b1\/reschedule$/.test(req.url()) && req.method() === 'POST',
  );
  await page.route('**/api/v1/bookings/*/reschedule', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );

  await page.getByRole('button', { name: /confirmer le report/i }).click();

  const body = (await rescheduleRequest).postDataJSON();
  expect(body.newSlotStart).toBe(SLOTS[0].start);

  // Le dialogue se referme.
  await expect(page.getByRole('alertdialog')).toBeHidden();
});
