import { test, expect, type Page } from '@playwright/test';

// ── e2e installation : champs « marque » / « modèle » de la réservation.
//   G2 a remplacé les inputs texte libre par des listes déroulantes marque → modèle →
//   dimensions, alimentées par le catalogue serveur (GET /products/shelter-catalog).
//   1. Mode catalogue (cas nominal) : choisir une marque peuple les modèles ; choisir un
//      modèle affiche ses dimensions ; la soumission envoie les chaînes exactes (L-004).
//   2. Mode dégradé (catalogue vide) : repli inputs texte ; le garde excludedBrand
//      (ShelterLogic) reste actif et bloque la soumission (L-008 : on garde le garde).
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

// Catalogue de test : une marque avec deux modèles (dont un avec dimensions).
const CATALOG = [
  {
    brand: 'Abris Tempo',
    models: [
      { model: 'Tempo Auto 11x16', slug: 'abri-simple', widthCm: 335, lengthCm: 488, heightCm: 244 },
      { model: 'Tempo Sans Dim', slug: 'abri-sans-dim', widthCm: null, lengthCm: null, heightCm: null },
    ],
  },
];

// Un créneau futur (la page n'affiche que des créneaux à venir).
function futureSlot(): { start: string; end: string } {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 7);
  start.setUTCHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(16, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function gotoInstallation(page: Page, catalog: unknown): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'e2e.fake.jwt');
    localStorage.setItem('auth_user', user);
  }, JSON.stringify(AUTH_USER));

  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: PROFILE }));
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: [futureSlot()] }),
  );
  await page.route('**/api/v1/products/shelter-catalog', (route) =>
    route.fulfill({ json: catalog }),
  );

  await page.goto('/installation');
  await expect(page.locator('#brand')).toBeVisible();
  // Choisir le créneau proposé. Le radio est visuellement masqué (sr-only) et son
  // <label> intercepte le pointeur → on coche via le label cliquable.
  await page.locator('label.booking__slot').first().click();
  await expect(page.getByRole('radio').first()).toBeChecked();
}

test('Catalogue — choix marque puis modèle, dimensions affichées, POST avec chaînes exactes', async ({ page }) => {
  let postedBody: unknown = null;
  await page.route('**/api/v1/bookings', (route) => {
    if (route.request().method() === 'POST') postedBody = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 'b1' } });
  });

  await gotoInstallation(page, CATALOG);

  // Le select modèle est désactivé tant qu'aucune marque n'est choisie.
  await expect(page.locator('#model')).toBeDisabled();

  // Choisir la marque → les modèles se peuplent et le select modèle s'active.
  await page.locator('#brand').selectOption('Abris Tempo');
  await expect(page.locator('#model')).toBeEnabled();

  // Choisir un modèle avec dimensions → dimensions visibles (lecture seule).
  await page.locator('#model').selectOption('Tempo Auto 11x16');
  await expect(page.locator('#inst-model-dims')).toContainText('11');

  await page.getByRole('button', { name: /confirmer la réservation/i }).click();
  await expect.poll(() => postedBody).not.toBeNull();
  // Chaînes exactes du catalogue envoyées au serveur (L-004, contrat inchangé).
  expect(postedBody).toMatchObject({ brand: 'Abris Tempo', model: 'Tempo Auto 11x16' });
});

test('Mode dégradé (catalogue vide) — repli texte, garde ShelterLogic actif et soumission bloquée', async ({ page }) => {
  let postCalled = false;
  await page.route('**/api/v1/bookings', (route) => {
    if (route.request().method() === 'POST') postCalled = true;
    return route.fulfill({ status: 201, json: { id: 'b1' } });
  });

  // Catalogue vide → la page dégrade vers des inputs texte.
  await gotoInstallation(page, []);

  // En repli, #brand est un input texte modifiable.
  await page.locator('#brand').fill('ShelterLogic');
  await page.locator('#brand').blur();

  // Message d'erreur accessible (role="alert") visible — le garde excludedBrand tient (L-008).
  await expect(
    page.getByRole('alert').filter({ hasText: /ShelterLogic/i }),
  ).toBeVisible();

  // Tenter de soumettre : la validation client doit bloquer l'envoi.
  await page.getByRole('button', { name: /confirmer la réservation/i }).click();
  await page.waitForTimeout(300);
  expect(postCalled).toBe(false);
});
