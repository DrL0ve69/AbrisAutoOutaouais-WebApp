import { test, expect } from '@playwright/test';

// ── e2e (sur `ng serve`) : le MÉCANISME du sélecteur de langue.
//
// L'i18n est compile-time (fr à « / », en à « /en/ »). En `ng serve` SEUL le
// français est servi et le routeur renvoie « /en/… » vers l'accueil (route
// « ** »), donc on ne peut PAS y observer la bascule complète. On y vérifie :
//   1. un SEUL bouton, vers l'AUTRE langue (jamais les deux à la fois) ;
//   2. cliquer CIBLE « /en » en conservant le chemin (/boutique → /en/boutique).
// La bascule réelle (contenu traduit, retour FR) est couverte par
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

test('cliquer « EN » cible /en en conservant le chemin courant', async ({ page }) => {
  await page.goto('/boutique');

  // Intercepte la navigation pleine page vers /en/… pour CAPTURER sa cible avant
  // que le repli SPA ne recharge l'app (et ne redirige vers l'accueil en dev).
  let target: string | null = null;
  await page.route('**/en/**', (route) => {
    if (route.request().isNavigationRequest() && target === null) {
      target = route.request().url();
    }
    return route.abort();
  });

  await page.getByRole('button', { name: 'Passer en anglais' }).click();

  await expect.poll(() => target).not.toBeNull();
  expect(new URL(target!).pathname).toBe('/en/boutique');
});
