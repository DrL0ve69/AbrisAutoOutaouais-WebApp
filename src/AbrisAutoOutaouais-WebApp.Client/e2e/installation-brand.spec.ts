import { test, expect, type Page } from '@playwright/test';

// ── e2e (Épic C) : champ « marque » de la réservation d'installation.
//   1. Saisir « ShelterLogic » affiche un message d'erreur visible (role="alert") et
//      la soumission est BLOQUÉE côté client (aucun POST /bookings).
//   2. Une autre marque (« Abri Plus ») passe la validation client → POST /bookings émis.
// API simulée via page.route (aucun backend), comme address-autofill.spec.ts.

const AUTH_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'client@test.com',
  username: 'client',
  firstName: 'Camille',
  lastName: 'Client',
  roles: ['Customer'],
  avatar: null,
};

const PROFILE = {
  ...AUTH_USER,
  phoneNumber: null,
  preferredLanguage: 'fr',
  defaultDeliveryAddress: {
    civicNumber: '123',
    street: 'rue des Érables',
    apartment: null,
    city: 'Gatineau',
    province: 'QC',
    postalCode: 'J8X 1A1',
    country: 'Canada',
  },
  createdAt: '2026-01-01T00:00:00Z',
};

// Un créneau futur (la page n'affiche que des créneaux à venir).
function futureSlot(): { start: string; end: string } {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 7);
  start.setUTCHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(16, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function gotoInstallation(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'e2e.fake.jwt');
    localStorage.setItem('auth_user', user);
  }, JSON.stringify(AUTH_USER));

  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: [futureSlot()] }),
  );

  await page.goto('/installation');
  await expect(page.locator('#brand')).toBeVisible();
  // Choisir le créneau proposé. Le radio est visuellement masqué (sr-only) et son
  // <label> intercepte le pointeur → on coche via le label cliquable.
  await page.locator('label.booking__slot').first().click();
  await expect(page.getByRole('radio').first()).toBeChecked();
}

test('ShelterLogic — message d’erreur visible et soumission bloquée', async ({ page }) => {
  let postCalled = false;
  await page.route('**/api/v1/bookings', (route) => {
    if (route.request().method() === 'POST') postCalled = true;
    return route.fulfill({ status: 201, json: { id: 'b1' } });
  });

  await gotoInstallation(page);

  await page.locator('#brand').fill('ShelterLogic');
  await page.locator('#brand').blur();

  // Message d'erreur accessible (role="alert") visible.
  await expect(
    page.getByRole('alert').filter({ hasText: /ShelterLogic/i }),
  ).toBeVisible();

  // Tenter de soumettre : la validation client doit bloquer l'envoi.
  await page.getByRole('button', { name: /confirmer la réservation/i }).click();
  await page.waitForTimeout(300);
  expect(postCalled).toBe(false);
});

test('Autre marque (« Abri Plus ») — la soumission émet le POST', async ({ page }) => {
  let postedBody: unknown = null;
  await page.route('**/api/v1/bookings', (route) => {
    if (route.request().method() === 'POST') postedBody = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 'b1' } });
  });

  await gotoInstallation(page);

  await page.locator('#brand').fill('Abri Plus');
  await page.locator('#model').fill('Garage 12x20');
  await page.locator('#brand').blur();

  // Aucun message d'exclusion.
  await expect(page.getByRole('alert').filter({ hasText: /ShelterLogic/i })).toHaveCount(0);

  await page.getByRole('button', { name: /confirmer la réservation/i }).click();
  await expect.poll(() => postedBody).not.toBeNull();
  expect(postedBody).toMatchObject({ brand: 'Abri Plus', model: 'Garage 12x20' });
});
