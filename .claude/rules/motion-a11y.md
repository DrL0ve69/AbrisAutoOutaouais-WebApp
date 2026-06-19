# Motion & a11y — checklist tokens/animation/cartes (AbrisTempo Local)

> **Ce que c'est.** Une checklist opérationnelle à dérouler **avant de finir** toute édition qui
> touche le **mouvement** (animations, transitions, scroll, curseur), les **couleurs/jetons**
> (`_tokens.scss`, fonds translucides, dégradés, états hover) ou les **cartes/lib lourdes**
> (Leaflet/geoman/turf, three.js, autocomplétion d'adresse). Elle condense les leçons réellement
> vécues (voir `.claude/rules/lessons-learned.md`) en gestes concrets. Le hook `PostToolUse`
> (`post-edit-guardrail.mjs`) pointe ici automatiquement quand un fichier de mouvement/scss change.
>
> **Règle d'or transverse :** WCAG 2.2 AA est une **barre dure**. Le contraste et le contrat clavier
> ne sont **pas** vérifiables en vitest — ils se valident en **Playwright e2e + axe** (cf. plus bas).

---

## 1 · Mouvement réduit (`prefers-reduced-motion: reduce`) — ceinture **ET** bretelles

Toute animation doit avoir un repli « sans mouvement », posé à **deux** endroits :

- **TS** — via `MotionService` (`core/services/motion.service.ts`, signal `prefersReducedMotion`,
  SSR-safe). Aucune auto-rotation, aucun scrub/parallaxe, aucun curseur animé quand il est vrai.
- **CSS** — un bloc `@media (prefers-reduced-motion: reduce)` qui neutralise `transition`/`animation`
  et `will-change` (au cas où le JS ne s'exécute pas : SSR, JS coupé, hydratation tardive).

Gestes :

- [ ] Décor animé = **`aria-hidden`** et **non essentiel** : le contenu sémantique (h1, CTA, stats)
      est lu et atteignable **sans** mouvement ni JS (rendu serveur = état final).
- [ ] État initial d'animation posé **en JS, jamais en CSS** (`opacity:0` en CSS = contenu invisible
      si SSR/JS coupé + CLS au chargement). Cf. `reveal-on-scroll`, `count-up` (E3).
- [ ] `count-up` / compteurs : **décoratifs**, valeur finale **immédiate** sous reduced-motion/SSR,
      pas d'`aria-live` (sinon spam lecteur d'écran).
- [ ] `cursor-ring` : `aria-hidden`, `pointer-events:none`, **jamais `cursor:none`**, actif seulement
      `@media (pointer: fine)` **et** mouvement non réduit.
- [ ] **Focus après rendu** quand un `signal` ajoute/retire l'élément ciblé (`setTimeout`/
      `afterNextRender`/`effect` lisant un `viewChild`), **pas** dans le même tick (L-006).
      Exception : cible **statique** déjà montée → `.focus()` synchrone après `set()` est sûr (L-015).
- [ ] Le hero d'accueil est **statique** (l'ancien récit GSAP « scroll story » épinglé a été retiré ;
      `gsap` n'est plus dans le bundle). Les révélations au défilement passent par des **directives
      IntersectionObserver** (`reveal-on-scroll`), pas par un épinglage scroll. Si tu réintroduis du
      mouvement au défilement, garde le contenu rendu d'emblée et déroule cette section.

**Vérif :** `e2e/motion-a11y.spec.ts` Bloc A émule `reducedMotion: 'reduce'` (réel) — hero statique
(zéro `.pin-spacer`), cursor-ring inactif, viewer 3D stable sans auto-rotation. Chaque assertion
**négative** est doublée d'une **positive** prouvant que l'élément est bien rendu (L-002/L-009).

---

## 2 · Jetons sémantiques **seulement** — le contraste se valide en e2e, pas en vitest

- [ ] **Jamais** de couleur en dur dans un composant : utilise un **jeton sémantique** (`_tokens.scss`)
      qui **bascule par thème**. Corriger une régression de contraste se fait **au niveau jeton**,
      pas en patch local (E5).
- [ ] Les jetons « sur-sombre » (blanc fixe, **non surchargés en thème sombre** — `--color-on-dark`,
      `--color-brand-on-dark`, `.btn--secondary`) n'appartiennent qu'aux **surfaces sombres**.
      Les poser sur une surface **claire** = échec de contraste invisible à l'œil rapide
      (E5 : « Voir en 3D » réutilisait `.btn--secondary` sur fiche claire → **1.1:1**). Sur une
      surface qui change de thème, utilise des jetons qui basculent (`--color-text`/`--color-bg-muted`).
- [ ] Un contrôle posé sur la **marque rouge** (bandeau CTA) : `.btn--inverse` (fond clair + texte
      rouge sombre ≈8.3:1), **pas** `.btn--primary` (rouge sur rouge, invisible).
- [ ] **`color-contrast` est DÉSACTIVÉ en vitest** (`src/testing/axe-helper.ts:14`, par conception —
      styles globaux non chargés au rendu unitaire, L-016). Donc « zéro axe vitest » **ne prouve rien**
      sur le contraste. Quand tu rapportes une garde axe sur un diff couleur, **qualifie-la**
      (« vitest — color-contrast NON couvert ; contraste validé en e2e/live »).
- [ ] **Vérif obligatoire** sur tout diff couleurs/jetons/fonds/translucides/hover : `npm run e2e`
      (`motion-a11y.spec.ts` Bloc B) — balayage axe **DUAL-THÈME** (clair **et** sombre,
      `color-contrast` inclus), navbar **scrollée** (verre `.navbar--scrolled` = pire cas), routes
      redessinées. Doubler d'un round-trip live (L-001) dans **les deux thèmes**.

---

## 3 · Cartes / libs lourdes / autocomplétion — `@defer` + import dynamique SSR-safe

- [ ] **Aucun** symbole `gsap`/`three`/`leaflet`/`turf`/`window`/`document` au **niveau module**
      (casse le SSR + alourdit le bundle initial). Import **dynamique** dans `afterNextRender`, gardé
      `isPlatformBrowser` (+ `isWebglAvailable` pour three).
- [ ] **Interop CJS↔ESM** normalisée selon le bundler : `const lib = ns.default ?? ns;` (le
      « X is not a function » du correctif Leaflet `L.map`, Épic D ; même garde pour GSAP/three).
- [ ] Montage derrière **`@defer (on interaction)`** (ou `on viewport`) avec `@placeholder` /
      `@loading` / `@error` (repli image si no-WebGL/SSR). Le viewer 3D ne monte que si les **3
      dimensions** existent. Teardown au `DestroyRef` (`mm.revert()` GSAP autrefois ;
      `dispose()`+`forceContextLoss()` WebGL ; `map.remove()` Leaflet).
- [ ] **Confirme que le bundle initial ne grossit pas** : `index.html` **sans** `<script>`
      gsap/three/leaflet (libs en chunks lazy). C'est une gate perf E5.
- [ ] **Adresse** : l'autocomplétion passe par le **proxy backend** (`IPlacesService` —
      Photon défaut/Radar/Google), **jamais** un appel tiers direct depuis le client. Chaque adaptateur
      doit émettre le **format canonique** — province **code 2 lettres** (L-011/L-004) ; le test double
      doit imiter la forme du **provider par défaut** (Photon, nom complet → normalisé), pas une forme
      déjà conforme qui masque le trou.
- [ ] e2e SSR+hydratation : taper via le **locator** (`pressSequentially`) + barrière réseau
      (`waitForResponse(/places\/suggest/)`), jamais `keyboard.type` + `waitForTimeout` (L-012).

---

## 4 · Widgets composites (radiogroup/tablist/menu/listbox) — AXE ne suffit pas

- [ ] Rôles + `aria-checked`/`aria-selected` **présents ET** contrat clavier APG implémenté :
      **roving `tabindex`** (un seul stop de groupe) + `(keydown)` flèches/Home/End qui déplacent
      **sélection ET focus ensemble**. AXE valide les attributs **statiques**, **pas** le clavier
      (L-015). Factorise le calcul d'index dans un util **pur, testé** (`features/mesurer/util/
      radio-nav.util.ts`).
- [ ] Ajoute un **test clavier** : presse une flèche → assert le flip de sélection **et**
      `toHaveFocus()` sur la nouvelle option.

---

## 5 · Hygiène e2e / locators (rappels qui cassent des specs SANS rapport)

- [ ] Un **landmark/live-region global** ajouté dans un shell partagé (`app.html`) élargit le set de
      match de **tout** `getByRole('status'|'alert'|…)` non scopé de la suite → re-ancre par nom
      accessible/texte (L-010).
- [ ] Après un correctif, **traque** les specs qui épinglent l'**ancien** mécanisme (assert l'attribut
      au lieu du comportement) et les **exclusions/skips** qui citent le bug corrigé — corrige-les
      dans le **même** commit (L-008). Cite l'ID du bug dans les commentaires de contournement.
- [ ] Avant de blâmer un e2e (ou de le déclarer vert), confirme **aucun `ng serve` zombie** sur
      4200/4300 (`reuseExistingServer: true` attache Playwright à un bundle **périmé**, L-017).
      `netstat` vide avant chaque run ; au doute, `window.ng.getComponent()` pour confirmer le bundle servi.
- [ ] Une garde de régression ne garde que si **CI l'exécute** : vérifie `.github/workflows/ci.yml`
      (`npm run e2e` / `npm test` / `npm run build` / `dotnet test`) — un spec hors glob = doc, pas
      enforcement (L-005).

---

## 6 · Pré-livraison UI/UX (idées tierces vérifiées, repliées ici)

> Distillé de `ui-ux-pro-max-skill` (évalué 2026-06-19, non installé — cf. `docs/resources.md`). On ne
> garde que le **non-redondant** ; le focus visible, le mouvement réduit, les breakpoints et les
> cibles ≥ 44px sont déjà couverts §1–§4.

- [ ] **Anti-patron d'industrie — rester dans la marque.** Pas de dégradés/teintes génériques « violet/
      rose IA » ni de mode tape-à-l'œil sur une **marque de métier régionale** (abris d'auto) : on reste
      sur la palette Tempo (navy/rouge) et les jetons sémantiques. Une couleur « tendance » hors-marque
      est un défaut UX même si le contraste passe.
- [ ] **Check pré-livraison rapide** (en plus des gates §1–§5) : états du curseur cohérents (pas de
      `cursor:none`, §1), focus visible sur **chaque** interactif, comportement vérifié aux breakpoints
      mobile/desktop (L-009 : épingler le viewport), et libellés/i18n FR complets.

---

**Pré-commit, sur un diff mouvement/jetons/carte :** `npm run build` (typecheck) · `npm test`
(vitest/axe — contraste **non** couvert) · `npm run e2e` (axe dual-thème + reduced-motion réel —
**c'est là** que contraste et clavier se vérifient) · round-trip live L-001 dans les deux thèmes.
