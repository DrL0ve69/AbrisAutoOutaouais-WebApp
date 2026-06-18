import { test, expect, type Page } from '@playwright/test';
import { forceTheme, measuredContrast } from './support/contrast';

// ── e2e : garde de BALAYAGE du contraste TEXTE SAISI / FOND au focus sur une route PUBLIQUE ───────
//
// EPIC 12 partie 2. La partie 1 a corrigé le `background: white` codé en dur des champs auth
// (auth-input-contrast.spec.ts). Un inventaire a confirmé qu'aucune autre feuille scopée ne reproduit
// ce bug : les autres `:focus` de champ posent `background: var(--color-surface)` (qui bascule par
// thème). Cette garde VERROUILLE ce constat sur un formulaire public (`/location`) : focus + frappe
// sur le 1er champ, ratio WCAG calculé DIRECTEMENT (axe ne voit pas la valeur d'un `<input>` — L-016),
// dans les DEUX thèmes. Elle doit PASSER (preuve que l'inventaire est juste / non-régression).

const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

async function mockPlaces(page: Page): Promise<void> {
  // /location interroge le proxy Places à la frappe : on neutralise le réseau (aucun backend requis).
  await page.route('**/api/v1/places/suggest*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/places/lookup-postal-code*', (route) =>
    route.fulfill({ json: { postalCode: null } }),
  );
}

for (const theme of themes) {
  test(`champ /location au focus + frappe : texte lisible (≥ 4.5:1) — ${theme.libelle}`, async ({
    page,
  }) => {
    await forceTheme(page, theme.id);
    await mockPlaces(page);
    await page.goto('/location');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);

    // 1er champ texte du formulaire d'adresse (« Numéro civique » — scopé par son label, pas un
    // getByRole nu — L-010). On focalise puis on tape, et on attend que la valeur tienne réellement
    // dans le modèle de form (SSR + hydratation : un fill one-shot peut être écrasé — L-012).
    const champ = page.getByLabel(/numéro civique/i);
    await expect(champ).toBeVisible();
    await champ.click();
    await expect(async () => {
      await champ.fill('123');
      await expect(champ).toHaveValue('123');
    }).toPass();
    await expect(champ).toBeFocused();

    const ratio = await measuredContrast(champ);
    expect(
      ratio,
      `Contraste texte/fond du champ /location au focus (${theme.libelle}) : ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
}
