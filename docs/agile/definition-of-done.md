# Definition of Done (DoD) — AbrisTempo Local

> Une **User Story** n'est *Terminée* (colonne *Terminé* du tableau) que lorsque **tous** les
> critères ci-dessous sont vérifiés. La DoD encode la qualité non négociable : **tests verts,
> 0 violation axe, build OK, i18n balisé, revue de code**.

## Code & conventions

- [ ] Code conforme aux conventions du projet (Angular 21 : standalone, signals, `OnPush`, native control flow `@if/@for`, `inject()`, `host` au lieu de `@HostListener`).
- [ ] Aucune chaîne UI en dur : tout est **balisé i18n** (`i18n`/`$localize`) avec identifiant stable ; `npm run i18n:extract` ne casse pas les `id`.
- [ ] Pas de code mort ni de `console.log` ; pas de `any` non justifié (`unknown` sinon).
- [ ] **Pas de duplication** introduite (réutiliser `ProductCardComponent`, patrons `.btn`/`.field`).

## Tests

- [ ] **Tests unitaires verts** : `npm test` (Vitest) au front et `dotnet test` au back si la story touche le backend.
- [ ] **Tests d'accessibilité axe = 0 violation** :
  - composant : `expectNoA11yViolations` (`src/testing/axe-helper.ts`) sur les nouveaux composants ;
  - e2e : scénario Playwright (`e2e/a11y.spec.ts`) avec `color-contrast` **actif** si une page est ajoutée/modifiée.
- [ ] Les **critères d'acceptation** de la story sont tous démontrables.

## Accessibilité (WCAG 2.2 AA)

- [ ] **Navigation clavier** complète : ordre logique, focus visible (anneau 3px), activation, fermeture (`Échap`) et **retour de focus** au déclencheur.
- [ ] **Lecteur d'écran** : nom/rôle/valeur corrects ; états annoncés (`aria-live`, `role=status/alert`) ; vérifié avec NVDA ou VoiceOver pour les interactions nouvelles.
- [ ] **Contraste** ≥ 4.5:1 (texte) / 3:1 (UI) — via les design tokens documentés.
- [ ] **Cibles** ≥ 24×24 (minimum AA), visé 44×44.
- [ ] **Thème sombre** vérifié si la story ajoute des couleurs (variantes dans le mixin `dark-theme`).
- [ ] `prefers-reduced-motion` respecté pour toute animation ajoutée.

## Build & intégration

- [ ] **Build OK** : `npm run build:prod` (SSR) sans erreur ni warning bloquant.
- [ ] L'application **fonctionne en SSR** (pas d'accès direct à `window`/`document` sans garde `isPlatformBrowser`).
- [ ] Aucune **régression** sur les pages existantes (suite e2e a11y toujours verte).

## Revue & traçabilité

- [ ] **Revue de code** effectuée et approuvée (au moins un relecteur) sur une **branche de fonctionnalité** (jamais sur `master`).
- [ ] Commits en **Conventional Commits** ; message en français.
- [ ] La story est **liée** à son Epic/Feature dans le suivi (Azure DevOps) ; les bugs trouvés sont créés et liés.
- [ ] La documentation impactée est mise à jour si nécessaire.

## Definition of Done — niveau « Sprint »

En plus de la DoD par story, un sprint est *Done* quand :
- [ ] L'**increment est démontrable** (objectif de sprint atteint).
- [ ] La **dette identifiée** est consignée en backlog (ex. US-2.7 retrait auth legacy, US-3.7 extension e2e).
- [ ] La **rétrospective** est tenue et produit au moins une **action de process**.
