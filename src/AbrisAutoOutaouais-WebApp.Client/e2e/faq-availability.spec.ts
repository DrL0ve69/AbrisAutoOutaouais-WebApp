import { test, expect, type Page } from '@playwright/test';

// ── e2e (sur `ng serve`) : sous-tâche B4 « Heuristiques ».
//   1. FAQ : l'accordéon natif <details> s'ouvre/se ferme au clic, présent sur
//      /installation et /location, et porte la mention « autres marques sauf
//      ShelterLogic ».
//   2. Disponibilité (H5) : le validateur asynchrone debounced du formulaire
//      d'inscription annonce « déjà pris » / « disponible » selon l'API (mockée).

const availableSlots = [
  { start: '2026-07-01T13:00:00', end: '2026-07-01T15:00:00' },
];

const rentableList = {
  items: [
    {
      id: 'p1',
      name: 'Abri simple Tempo',
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

async function mockBookingApis(page: Page): Promise<void> {
  await page.route('**/api/v1/bookings/available-slots*', (route) =>
    route.fulfill({ json: availableSlots }),
  );
  await page.route('**/api/v1/products*', (route) => route.fulfill({ json: rentableList }));
}

test.describe('FAQ accordéon', () => {
  test('s’affiche sur /installation avec la mention ShelterLogic et s’ouvre au clic', async ({
    page,
  }) => {
    await mockBookingApis(page);
    await page.goto('/installation');

    const faqHeading = page.getByRole('heading', { level: 2, name: /foire aux questions/i });
    await expect(faqHeading).toBeVisible();

    // La question sur les marques est repliée : sa réponse n'est pas visible.
    const marquesQuestion = page.getByText(/installez-vous d'autres marques/i);
    await expect(marquesQuestion).toBeVisible();
    const shelterLogicAnswer = page.getByText(/à l'exception de ShelterLogic/i);
    await expect(shelterLogicAnswer).toBeHidden();

    // Au clic, le panneau s'ouvre et la réponse devient visible.
    await marquesQuestion.click();
    await expect(shelterLogicAnswer).toBeVisible();
  });

  test('s’affiche sur /location', async ({ page }) => {
    await mockBookingApis(page);
    await page.goto('/location');

    await expect(
      page.getByRole('heading', { level: 2, name: /foire aux questions/i }),
    ).toBeVisible();
    await expect(page.getByText(/durée minimale d'une location/i)).toBeVisible();
  });
});

test.describe('Disponibilité asynchrone à l’inscription (H5)', () => {
  test('annonce « déjà pris » quand le nom d’utilisateur est indisponible', async ({ page }) => {
    // L'API de disponibilité est mockée (pas de backend en `ng serve`).
    await page.route('**/api/v1/auth/availability*', (route) =>
      route.fulfill({ json: { usernameAvailable: false, emailAvailable: null } }),
    );

    await page.goto('/auth');
    // Basculer vers l'inscription.
    await page.getByRole('button', { name: /s'inscrire/i }).click();
    await expect(page.getByRole('heading', { name: /créer un compte/i })).toBeVisible();

    const username = page.getByLabel(/nom d'utilisateur/i);
    await username.fill('admin');
    await username.blur();

    await expect(page.getByText(/déjà pris/i)).toBeVisible();
  });

  test('annonce « disponible » quand le nom d’utilisateur est libre', async ({ page }) => {
    await page.route('**/api/v1/auth/availability*', (route) =>
      route.fulfill({ json: { usernameAvailable: true, emailAvailable: null } }),
    );

    await page.goto('/auth');
    await page.getByRole('button', { name: /s'inscrire/i }).click();
    await expect(page.getByRole('heading', { name: /créer un compte/i })).toBeVisible();

    await page.getByLabel(/nom d'utilisateur/i).fill('nom-libre');

    await expect(page.getByText(/nom d'utilisateur disponible/i)).toBeVisible();
  });
});
