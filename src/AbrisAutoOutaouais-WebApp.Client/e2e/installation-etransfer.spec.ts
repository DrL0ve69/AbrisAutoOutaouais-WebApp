import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e (EPIC 7.3) : tunnel d'INSTALLATION COMPLET avec paiement par VIREMENT INTERAC (e-Transfer).
// Un client CONNECTÉ choisit un créneau, un type, une adresse, puis confirme → la réservation est
// créée (POST /bookings → 201 { id, payment }) et la page bascule sur le panneau d'instructions
// Interac (état terminal — L-053) affichant reference / recipientEmail / amount. AUCUNE redirection
// automatique. Le panneau est balayé par axe dans LES DEUX thèmes (contraste non couvert en vitest —
// L-016 ; le balayage vit donc en e2e — L-005).
// Non-vacuité : sur un revert (panneau absent), le `getByRole('heading', …)` échoue → la garde mord.
//
// SSR + hydratation : on capte le POST via barrière réseau `waitForResponse` (pas de
// waitForTimeout — L-012). L'API est simulée via page.route.

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

const PAYMENT = {
  reference: 'INST-ETR-7777',
  recipientEmail: 'paiements@abristempo.ca',
  amount: 150,
  instructions:
    'Ouvrez votre application bancaire, choisissez « Virement Interac » et inscrivez la référence dans le message.',
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
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: [futureSlot()] }),
  );
  // Catalogue vide → repli champs texte (le tunnel reste soumissible sans choisir de marque).
  await page.route('**/api/v1/products/shelter-catalog', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/bookings', (route) =>
    route.fulfill({ status: 201, json: { id: 'booking-etr', payment: PAYMENT } }),
  );
}

/** Choisit le créneau proposé et remplit l'adresse d'intervention. */
async function fillBookingForm(page: Page): Promise<void> {
  await page.goto('/installation');
  await expect(page.getByRole('heading', { level: 1, name: /réserver une installation/i })).toBeVisible();

  // 1) Choisir le créneau proposé (le radio est sr-only, son label intercepte le pointeur).
  await page.locator('label.booking__slot').first().click();
  await expect(page.getByRole('radio').first()).toBeChecked();

  // 2) Adresse. fill via le locator (SSR+hydratation — L-012).
  await page.locator('#civicNumber').fill('123');
  await page.locator('#street').fill('rue des Érables');
  await page.locator('#city').fill('Gatineau');
  await page.locator('#province').fill('QC');
  await page.locator('#postalCode').fill('J8X 1A1');
}

for (const theme of themes) {
  test(`Installation → virement Interac : panneau d'instructions affiché et accessible — ${theme.libelle}`, async ({
    page,
  }) => {
    await forceTheme(page, theme.id);
    await signIn(page);
    await mockApi(page);
    await fillBookingForm(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // Confirme la réservation → POST /bookings (barrière réseau, L-012).
    const bookingResponse = page.waitForResponse(
      (resp) => resp.url().endsWith('/api/v1/bookings') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /confirmer la réservation/i }).click();
    await bookingResponse;

    // Panneau e-Transfer (état terminal — L-053) : titre focalisé (L-006) + les trois informations.
    const heading = page.getByRole('heading', {
      name: /réglez votre réservation par virement interac/i,
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(PAYMENT.reference)).toBeVisible();
    await expect(page.getByText(PAYMENT.recipientEmail)).toBeVisible();
    // Montant (150,00 $ en fr-CA) présent.
    await expect(page.getByText(/150[.,]00/)).toBeVisible();
    // Le formulaire de réservation a disparu (état terminal).
    await expect(page.getByRole('button', { name: /confirmer la réservation/i })).toHaveCount(0);

    // Balayage axe du panneau d'instructions (contraste inclus, dual-thème — L-016).
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations,
      `Violations axe (${theme.libelle}) : ${results.violations.map((v) => v.id).join(', ')}`,
    ).toEqual([]);
  });
}
