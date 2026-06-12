import { test, expect } from '@playwright/test';

// ── e2e (sur l'hôte localisé scripts/serve-i18n.mjs, baseURL :4300) : la BASCULE
// RÉELLE entre les deux builds localisés — impossible à observer en `ng serve`
// (qui ne sert que le français). Nécessite `npm run build:i18n` au préalable ;
// le webServer Playwright « i18n » s'en charge (cf. playwright.config.ts).

test('le français est servi à « / » avec un bouton vers l’anglais', async ({ page }) => {
  await page.goto('/');
  const toEn = page.getByRole('button', { name: 'Passer en anglais' });
  await expect(toEn).toBeVisible();
  await expect(toEn).toHaveText('EN');
});

test('l’anglais est servi à « /en/ » avec un bouton (traduit) vers le français', async ({
  page,
}) => {
  await page.goto('/en/');

  const toFr = page.getByRole('button', { name: 'Switch to French' });
  await expect(toFr).toBeVisible();
  await expect(toFr).toHaveText('FR');
  await expect(toFr).toHaveAttribute('lang', 'fr');

  // On ne montre jamais les deux langues à la fois.
  await expect(page.getByRole('button', { name: 'Passer en anglais' })).toHaveCount(0);
});

test('revenir au français depuis /en/boutique conserve le chemin', async ({ page }) => {
  await page.goto('/en/boutique');

  await Promise.all([
    page.waitForURL((url) => new URL(url).pathname === '/boutique'),
    page.getByRole('button', { name: 'Switch to French' }).click(),
  ]);

  expect(new URL(page.url()).pathname).toBe('/boutique');
  await expect(page.getByRole('button', { name: 'Passer en anglais' })).toBeVisible();
});
