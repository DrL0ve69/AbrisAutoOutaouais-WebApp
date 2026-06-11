# Definition of Ready (DoR) — AbrisTempo Local

> Une **User Story** ne peut être tirée dans un sprint (passer de *Backlog* à *À faire*) que si
> **tous** les critères ci-dessous sont satisfaits. La DoR protège l'équipe du travail mal
> cadré et garantit que l'accessibilité est pensée **avant** le développement, pas après.

## Critères généraux

- [ ] La story suit le format **« En tant que… je veux… afin de… »** avec un bénéfice utilisateur clair.
- [ ] Elle est rattachée à un **Epic / Feature** (cf. `product-backlog.md`).
- [ ] Elle est **estimée** en points (Fibonacci) par l'équipe ; si > 13, elle est **découpée**.
- [ ] La **priorité MoSCoW** est fixée (Must / Should / Could / Won't-now).
- [ ] Les **critères d'acceptation** sont rédigés, testables et non ambigus.
- [ ] Les **dépendances** (API, route, autre story) sont identifiées et non bloquantes.
- [ ] Les **maquettes / parcours** nécessaires sont disponibles (ou un croquis textuel du flux).

## Critères d'accessibilité (transverses — obligatoires)

- [ ] Les **exigences WCAG 2.2 AA** applicables à la story sont listées (ex. focus visible, libellés, `aria-live`, contraste).
- [ ] Le **parcours clavier** attendu est décrit (ordre de tabulation, activation, fermeture, retour de focus).
- [ ] Les **états** à annoncer aux lecteurs d'écran sont identifiés (chargement, succès, erreur, vide).
- [ ] Les **cibles tactiles** prévues respectent ≥ 24×24 (visé 44×44).
- [ ] Si la story touche un formulaire : champs avec `<label>`, `autocomplete`, messages d'erreur reliés (`aria-describedby`) prévus.

## Critères d'internationalisation

- [ ] Toute chaîne visible sera **balisée i18n** (`i18n`/`$localize`) avec un identifiant stable.
- [ ] Aucune chaîne en dur non traduisible.

## Critères techniques

- [ ] L'**approche de test** est connue (test unitaire, test axe composant et/ou e2e Playwright).
- [ ] Les **données de test / mocks** nécessaires sont disponibles ou faciles à produire.
- [ ] La story tient dans un sprint pour **une** personne (sinon découpage).

## Exemple appliqué — US-1.1 « Parcourir par catégorie »

- Critères d'acceptation : `h1` unique ; chips `<button>` + `aria-pressed` ; rechargement de liste sans reload ; états `aria-busy`/`role=status` ; 0 violation axe e2e `/boutique`.
- Parcours clavier : Tab atteint chaque chip ; Entrée active ; focus visible (anneau 3px).
- États annoncés : « Chargement des produits… », « Aucun produit dans cette catégorie ».
- i18n : `@@shop.catalog.title`, `@@shop.catalog.filterAll`, etc.
- Test : `home.a11y.spec.ts` (axe composant) + scénario Playwright `/boutique`.

➡️ Story **prête** : tous les points cochés.
