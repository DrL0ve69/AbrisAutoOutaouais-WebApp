import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e (EPIC 7.2) : tunnel de LOCATION COMPLET avec paiement par VIREMENT INTERAC (e-Transfer).
// Un client CONNECTÉ choisit un abri louable, une taille (longueur + hauteur), une période et une
// adresse, puis confirme → le contrat est créé (POST /rentals → 201 { id, payment }) et la page
// bascule sur le panneau d'instructions Interac (état terminal — L-053) affichant reference /
// recipientEmail / amount. AUCUNE redirection automatique. Le panneau est balayé par axe dans LES
// DEUX thèmes (contraste non couvert en vitest — L-016 ; le balayage vit donc en e2e — L-005).
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

// Modèle LOUABLE (forme `RentableShelterModel`) : longueurs 335/503/671 cm, hauteur unique 198 cm.
const RENTABLE = {
  slug: 'abri-simple',
  name: 'Abri simple Tempo',
  categoryName: 'Abris simples',
  monthlyRentalPrice: 89,
  minLengthCm: 335,
  maxLengthCm: 671,
  lengthStepCm: 168,
  widthCm: 335,
  clearHeightOptionsCm: [198],
  priceGrid: [
    { lengthCm: 335, clearHeightCm: 198, priceCents: 120000 },
    { lengthCm: 503, clearHeightCm: 198, priceCents: 140000 },
    { lengthCm: 671, clearHeightCm: 198, priceCents: 160000 },
  ],
};

const PAYMENT = {
  reference: 'LOC-ETR-7777',
  // Montant viré = TOTAL du contrat (tarif 89 $/mois × 3 mois, 2026-07-01 → 2026-10-01) — décision
  // propriétaire EPIC 7.2 : le client vire le total du contrat d'avance, pas un seul mois.
  recipientEmail: 'paiements@abristempo.ca',
  amount: 267,
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
  await page.route('**/api/v1/shelters/rentable', (route) => route.fulfill({ json: [RENTABLE] }));
  await page.route('**/api/v1/rentals', (route) =>
    route.fulfill({ status: 201, json: { id: 'rental-etr', payment: PAYMENT } }),
  );
}

/** Sélectionne le modèle, la taille (longueur 335 cm + hauteur par défaut), la période et l'adresse. */
async function fillRentalForm(page: Page): Promise<void> {
  await page.goto('/location');
  await expect(page.getByRole('heading', { level: 1, name: /louer un abri/i })).toBeVisible();

  // 1) Choisir l'abri (révèle le sélecteur de taille).
  await page.getByText(RENTABLE.name).first().click();
  const lengthSelect = page.getByRole('combobox', { name: /longueur/i });
  await expect(lengthSelect).toBeVisible();

  // 2) Longueur 335 cm (« 11 pi ») — hauteur 198 cm par défaut → couple offert.
  await lengthSelect.selectOption({ label: '11 pi' });

  // 3) Période + adresse. EPIC 15 — champ unifié « n° et rue ». fill via le locator (L-012).
  await page.locator('#loc-startDate').fill('2026-07-01');
  await page.locator('#loc-endDate').fill('2026-10-01');
  await page.locator('#loc-address-line1').fill('123 rue des Érables');
  await page.locator('#loc-city').fill('Gatineau');
  await page.locator('#loc-province').selectOption('QC');
  await page.locator('#loc-postalCode').fill('J8X 1A1');
}

for (const theme of themes) {
  test(`Location → virement Interac : panneau d'instructions affiché et accessible — ${theme.libelle}`, async ({
    page,
  }) => {
    await forceTheme(page, theme.id);
    await signIn(page);
    await mockApi(page);
    await fillRentalForm(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // Confirme la location → POST /rentals (barrière réseau, L-012).
    const rentalResponse = page.waitForResponse(
      (resp) => resp.url().endsWith('/api/v1/rentals') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /confirmer la location/i }).click();
    await rentalResponse;

    // Panneau e-Transfer (état terminal — L-053) : titre focalisé (L-006) + les trois informations.
    const heading = page.getByRole('heading', {
      name: /réglez votre location par virement interac/i,
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(PAYMENT.reference)).toBeVisible();
    await expect(page.getByText(PAYMENT.recipientEmail)).toBeVisible();
    // Montant TOTAL du contrat (267,00 $ en fr-CA = 89 $/mois × 3 mois) présent.
    await expect(page.getByText(/267[.,]00/)).toBeVisible();
    // Le formulaire de location a disparu (état terminal).
    await expect(page.getByRole('button', { name: /confirmer la location/i })).toHaveCount(0);

    // Balayage axe du panneau d'instructions (contraste inclus, dual-thème — L-016).
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations,
      `Violations axe (${theme.libelle}) : ${results.violations.map((v) => v.id).join(', ')}`,
    ).toEqual([]);
  });
}
