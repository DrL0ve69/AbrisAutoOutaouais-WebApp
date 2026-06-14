import { test, expect } from '@playwright/test';

// ── e2e (sur `ng serve`) : le MÉCANISME du sélecteur de langue en build MONO-locale.
//
// L'i18n est compile-time (fr à « / », en à « /en/ »). En `ng serve` SEUL le
// français est servi (`environment.localized = false`), donc il n'existe PAS de
// cible « /en » à servir. Le bouton est alors DÉGRADÉ (Épic C) : focusable mais
// inactif (`aria-disabled`), explication via `aria-describedby`, et un clic ne
// déclenche AUCUNE redirection silencieuse vers l'accueil fr. On y vérifie :
//   1. un SEUL bouton, vers l'AUTRE langue (jamais les deux à la fois) ;
//   2. son état dégradé (aria-disabled + explication reliée) ;
//   3. qu'un clic ne navigue PAS (pas de cible « /en »).
// La bascule réelle (build bilingue, contenu traduit, retour FR) est couverte par
// language-switch-i18n.spec.ts contre l'hôte localisé (scripts/serve-i18n.mjs).

test('affiche un seul bouton de langue, vers l’anglais, en français', async ({ page }) => {
  await page.goto('/');

  const toEn = page.getByRole('button', { name: 'Passer en anglais' });
  await expect(toEn).toBeVisible();
  await expect(toEn).toHaveText('EN');
  await expect(toEn).toHaveAttribute('lang', 'en');

  // Pas de second bouton « FR » : on ne montre jamais les deux langues à la fois.
  await expect(page.getByRole('button', { name: 'Switch to French' })).toHaveCount(0);
});

test('en build mono-locale, le bouton EN est dégradé (annoncé indisponible)', async ({ page }) => {
  await page.goto('/');

  const toEn = page.getByRole('button', { name: 'Passer en anglais' });
  await expect(toEn).toBeVisible();

  // Dégradé : aria-disabled (PAS l'attribut `disabled` natif, qui retirerait du
  // tab order) → le bouton reste FOCUSABLE.
  await expect(toEn).toHaveAttribute('aria-disabled', 'true');
  // PAS l'attribut `disabled` natif → le bouton n'est pas retiré du tab order.
  expect(await toEn.evaluate((el: HTMLButtonElement) => el.disabled)).toBe(false);
  await toEn.focus();
  await expect(toEn).toBeFocused();

  // L'explication est reliée via aria-describedby → un <span> sr-only scopé navbar.
  const descId = await toEn.getAttribute('aria-describedby');
  expect(descId).toBe('lang-unavailable');
  await expect(page.locator(`#${descId}`)).toHaveText(/version localisée/i);
  // L'infobulle souris porte le même message.
  await expect(toEn).toHaveAttribute('title', /version localisée/i);
});

test('en build mono-locale, cliquer « EN » ne déclenche AUCUNE navigation', async ({ page }) => {
  await page.goto('/boutique');

  // Toute navigation pleine page vers /en/… serait un bug (le no-op doit primer).
  let navigated = false;
  await page.route('**/en/**', (route) => {
    if (route.request().isNavigationRequest()) navigated = true;
    return route.abort();
  });

  await page.getByRole('button', { name: 'Passer en anglais' }).click({ force: true });

  // Laisse le temps à une éventuelle navigation de se déclencher : il ne doit RIEN
  // se passer — on reste sur /boutique (fr), pas de redirection vers l'accueil.
  await page.waitForTimeout(300);
  expect(navigated).toBe(false);
  expect(new URL(page.url()).pathname).toBe('/boutique');
});
