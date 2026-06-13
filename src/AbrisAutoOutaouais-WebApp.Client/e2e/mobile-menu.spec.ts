import { test, expect } from '@playwright/test';

// ── Menu hamburger (mobile / petite fenêtre) ───────────────────────────────
// Régression corrigée : le panneau était un descendant de <nav class="navbar">,
// dont le `backdrop-filter` crée un bloc conteneur local. Le `position: fixed`
// du panneau se référait donc à la navbar (haute de 68px) au lieu du viewport :
// le menu restait collé au sommet, « écrasé » et ne suivait pas le défilement.
// Le menu est désormais rendu HORS de la navbar → fixed = viewport.

test.use({ viewport: { width: 390, height: 780 } });

test('le menu hamburger couvre le viewport sous la navbar et suit le défilement', async ({
  page,
}) => {
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Ouvrir le menu de navigation' });
  await expect(toggle).toBeVisible();
  await toggle.click();

  const menu = page.locator('#mobile-menu');
  await expect(menu).toBeVisible();

  // Le panneau occupe toute la largeur et descend bien sous la navbar (≈68px),
  // pas « écrasé » dans la barre. Avant le correctif, la hauteur s'effondrait.
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(360); // ~pleine largeur (390)
  expect(box!.height).toBeGreaterThan(400); // couvre l'essentiel de la hauteur
  expect(box!.y).toBeLessThanOrEqual(70); // ancré juste sous la navbar

  // Fixé au viewport : après défilement, le panneau ne bouge pas.
  await page.evaluate(() => window.scrollTo(0, 600));
  const boxAfter = await menu.boundingBox();
  expect(boxAfter!.y).toBeLessThanOrEqual(70);

  // Disclosure : Échap referme le panneau et renvoie le focus au bouton
  // déclencheur (WCAG 2.1.2 / 2.4.3). Fermé, le panneau est `inert` (Bug-08) :
  // retiré de l'arbre d'accessibilité ET infocusable — l'ancien aria-hidden
  // laissait ses liens tabulables.
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('inert', '');
  await expect(toggle).toBeFocused();
});
