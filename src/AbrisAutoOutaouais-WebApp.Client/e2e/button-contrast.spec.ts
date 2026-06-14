import { test, expect } from '@playwright/test';

// Garde de régression Épic A — lisibilité des boutons-marque pleins (`.btn--primary`).
//
// Bug d'origine : les CTA `<a class="btn btn--primary">` (accueil, panier) devenaient
// illisibles UNE FOIS le lien :visited — `a:visited` (spécificité 0,1,1) battait
// `.btn--primary` (0,1,0) et imposait `--color-link-hover` (rouge sombre #991b1b en
// clair → quasi illisible sur rouge ; #f87171 en sombre → IDENTIQUE au fond → invisible).
// Corrigé en (1) scopant les couleurs de lien globales à `a:not(.btn)` et (2) faisant de
// `.btn--primary` un bouton-marque rouge FIXE + texte blanc `--color-on-brand` (2 thèmes).
//
// ⚠️ Deux limites honnêtes (L-016/L-009/L-005) :
//   1. L'état :visited n'est PAS lisible par getComputedStyle (restriction de
//      confidentialité du navigateur — c'est précisément pourquoi axe/wave ne voyaient
//      pas le bug). Ce test garde donc le demi-correctif vérifiable par outil — le JETON
//      (texte blanc on-brand) — même après avoir visité la cible. Le scope `:not(.btn)`
//      reste couvert par la revue + la vérif visuelle live (L-001).
//   2. Le cas porteur est le thème SOMBRE : l'ancien code (`--color-text-inverse`) valait
//      déjà #ffffff en clair, donc le cas clair ne PEUT PAS casser sur cette régression
//      (assertion quasi-vacueuse en clair, gardée seulement pour confirmer la non-régression).
//      En sombre, un revert vers `--color-text-inverse` donne #0f1923 ≠ blanc → ce test casse.
const WHITE = 'rgb(255, 255, 255)';

for (const theme of ['light', 'dark'] as const) {
  test(`CTA primaire « Voir le catalogue » lisible (blanc on-brand) — thème ${theme}`, async ({
    page,
  }) => {
    await page.goto('/');
    // Marquer /boutique comme visité (navigation réelle) puis revenir : reproduit le
    // contexte exact du bug (le CTA pointe vers /boutique).
    await page.goto('/boutique');
    await page.goto('/');
    // Le thème est piloté UNIQUEMENT par l'attribut [data-theme] (le media-query
    // prefers-color-scheme ne s'applique qu'à :root:not([data-theme])) — pas besoin
    // d'emulateMedia.
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);

    const cta = page.getByRole('link', { name: "Voir notre catalogue d'abris" });
    await expect(cta).toBeVisible();
    const color = await cta.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe(WHITE);
  });
}
