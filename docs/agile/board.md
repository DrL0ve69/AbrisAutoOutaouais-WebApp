# Tableau Scrum / Kanban — AbrisTempo Local (snapshot)

> Instantané du tableau en **début de Sprint 4** (après livraison des Sprints 1–3).
> Colonnes : **Backlog** → **À faire** (engagé ce sprint) → **En cours** → **Revue** → **Terminé**.
> Items réels du projet ; identifiants alignés sur `product-backlog.md`. Terminologie Azure
> DevOps (Story / Task / Bug).

## Vue d'ensemble

| Backlog | À faire | En cours | Revue | Terminé |
|---------|---------|----------|-------|---------|
| US-6.2 Checkout + révision | US-2.7 Retirer auth legacy | US-1.5 Recherche & tri catalogue | US-3.7 Étendre couverture axe e2e | US-1.1 Parcourir par catégorie |
| US-6.3 Réservation installation | US-1.6 Page panier révisable | | | US-1.2 Détail produit |
| US-6.4 Location saisonnière | US-3.6 Cibles tactiles ≥ 44px (chips) | | | US-1.3 Ajout au panier |
| US-2.6 Réinitialisation mot de passe | Bug-07 Menus fermables (`Échap`/clic ext.) | | | US-1.4 Seed produits/catégories |
| | | | | US-2.1 → 2.5 Auth + profil |
| | | | | US-3.1 → 3.5 A11y socle |
| | | | | US-4.1 i18n balisage |
| | | | | US-4.2/4.3 Bascule FR/EN + build localisé `/en/` |
| | | | | US-5.1/5.2/5.4 Thème |

---

## Détail des cartes actives (Sprint 4)

### À faire (engagé)
| ID | Titre | Type | Points | Critère « Done » clé |
|----|-------|------|:------:|----------------------|
| US-2.7 | Retirer les composants d'auth legacy (`login.ts`, `register.component.ts`) ; router tout sur `/auth` | Task techn. | 2 | Aucune route ne charge le legacy ; e2e auth verte |
| US-1.6 | Page panier révisable (modifier quantités, retirer un item) | Story | 8 | Étape révision (3.3.4) ; états annoncés ; axe 0 |
| US-3.6 | `min-height: 44px` sur `.catalog__chip` (`catalog.scss`, `home.scss`) | Task a11y | 2 | Cibles ≥ 44px vérifiées mobile |
| Bug-07 | Menus navbar non fermables au clavier (`Échap` + clic extérieur) | Bug | 3 | Fermeture + retour de focus au déclencheur |

### En cours
| ID | Titre | Type | Points | Assigné |
|----|-------|------|:------:|---------|
| US-1.5 | Recherche textuelle + tri (prix/dispo) + pagination serveur | Story | 5 | P. Charron |

### Revue
| ID | Titre | Type | Points | En attente de |
|----|-------|------|:------:|---------------|
| US-3.7 | Ajouter `/auth`, `/mon-compte/profil`, états d'erreur aux scénarios Playwright axe | Story | 3 | Revue de code + CI verte |

---

## Bugs résolus (référence — Sprint 3)

| ID | Titre | Critère WCAG | Correctif |
|----|-------|--------------|-----------|
| Bug-01 | Contraste footer / why-us < 4.5:1 | 1.4.3 | Palette `_tokens.scss` (ratios documentés) |
| Bug-02 | Skip-link disparaît à l'hydratation SSR | 2.4.1 | Visually-hidden-until-focus (`styles.scss`) |
| Bug-03 | Champs natifs illisibles en mode sombre OS | 1.4.3 / 1.4.11 | `color-scheme` light/dark (`_tokens.scss`) |
| Bug-04 | Focus indésirable sur `main` après skip | 2.4.7 | `main#main:focus { outline:none }` (`app.scss`) |
| Bug-05 | Dropdown navbar sous le contenu | 1.4.11 | Échelle `z-index` tokenisée |
| Bug-06 | Champ login refusait les noms d'utilisateur | 3.3.8 | Retrait de `Validators.email` (`auth.ts`) |

---

## Indicateurs du tableau

- **WIP limit** (En cours) : 2 — respecté (1 item en cours).
- **Cartes Terminées (Sprints 1–3)** : 20+ stories, 5 bugs a11y corrigés.
- **Lead time moyen** d'une story : ~ 4 jours ouvrés.
- **Ratio Bug / Story** : faible (5 bugs sur ~20 stories), concentré sur l'a11y détectée et corrigée **dans le même sprint**.

> Le tableau reflète une **a11y/UX traitée en flux continu** : les bugs d'accessibilité sont
> ouverts, priorisés et fermés au fil de l'eau (Bug-01→06), et les améliorations UX issues de
> l'évaluation heuristique alimentent directement le backlog (Bug-07, US-1.5, US-3.6).

---

## Mise à jour — clôture du Sprint 4 (2026-06-11)

Remédiations livrées à partir des évaluations UX/WCAG (boucle *audit → correctif → vérification → re-documentation*) :

| ID | Titre | Critère / Heuristique | Correctif | Statut |
|----|-------|-----------------------|-----------|--------|
| Bug-07 | Menus navbar fermables au clavier | H3 / WCAG 2.1.2 | Fermeture `Échap` + clic extérieur + **renvoi de focus** au déclencheur (`navbar.ts`, pattern disclosure) | ✅ Terminé |
| US-2.7 | Retrait de l'auth legacy | H4 / R1 | Suppression de `features/auth/login/` et `features/auth/register/` (code mort, aucune route) | ✅ Terminé |
| US-1.5 | Recherche + tri catalogue | H7 | Champ `role="search"` + tri (prix/nom/dispo) + annonce de résultats `role="status"` (`catalog.ts`) | ✅ Terminé |
| US-3.6 | Cibles tactiles ≥ 44px | 2.5.8 | `min-height: 44px` sur `.catalog__chip` + champs de la barre d'outils | ✅ Terminé |
| US-3.7 | Couverture axe e2e étendue | R3 | Scénarios `/auth` et `/panier` ajoutés à `e2e/a11y.spec.ts` | ✅ Terminé |
| — | Onglets profil au clavier | Task-flow T3 / ARIA APG | Roving `tabindex` + flèches + Home/End (`profile.ts`) | ✅ Terminé |
| — | Fil d'Ariane détail produit | H6 | Breadcrumb `Accueil / Boutique / Catégorie / Produit` (`product-detail.html`) | ✅ Terminé |
| — | Home dédupliquée | H8 | Section catalogue dupliquée retirée — vedettes + renvoi vers `/boutique` | ✅ Terminé |
| — | Logo évoquant un abri | H2 | Glyphe `⬡` remplacé par une icône d'abri (navbar + auth/reset) | ✅ Terminé |
| US-2.6 | Mot de passe oublié | H9 / Task-flow T2 | Page `/auth/reset` accessible (confirmation neutre anti-énumération) + **backend de bout en bout livré** (Épic B2, voir ci-dessous) | ✅ Terminé |
| — | Ancres non masquées | 2.4.11/2.4.12 (R7) | `scroll-padding-top` + `scroll-margin-top` (navbar sticky) | ✅ Terminé |

> Vérification : `npm run build` ✅, `npm test` (33/33) ✅. Drift corrigé au passage — `installation`/`location` sont désormais de **vrais formulaires** de réservation/location et le panier/caisse existent (les anciens « placeholders » des audits sont obsolètes).

---

## Nouveaux éléments détectés — backlog (Sprint 5)

| ID | Titre | Type | Critère WCAG | Détecté par | Statut |
|----|-------|------|--------------|-------------|--------|
| Bug-08 | Menu utilisateur de la navbar : `<ul role="menu" aria-hidden="true">` conserve des enfants **focusables** une fois fermé (`opacity:0; pointer-events:none` au lieu de `inert`/`display:none`) → violation axe `aria-hidden-focus` sur **toute page authentifiée** | Bug a11y | 4.1.2 (Name, Role, Value) | e2e d'annulation de location (`rental-cancel.spec.ts`) | ✅ Corrigé (branche `fix/a11y-contrast-dark-theme`) |

> **Contexte.** Distinct de Bug-07 (fermeture clavier/clic — déjà corrigé) : ici le menu *fermé*
> restait dans l'ordre de tabulation tout en étant `aria-hidden`.
> **Correctif appliqué** : `[inert]="!userMenuOpen()"` sur le menu déroulant utilisateur **et**
> sur le menu mobile (même patron fautif) — `aria-hidden` retiré, `inert` retire les enfants de
> l'ordre de tabulation et de l'arbre d'accessibilité. Garde de régression : `navbar.spec.ts`
> (assertions de focus réelles, 6 tests) ; l'exclusion `app-rentals` de l'axe pleine page dans
> `rental-cancel.spec.ts`, devenue obsolète, a été **retirée** — la navbar authentifiée est
> désormais couverte par axe.

---

## Mise à jour — clôture de l'Épic B « Sections manquantes » (2026-06-13)

Branche `feat/missing-sections`. Boucle *architecte → développeur → revue indépendante → mentor*.

| ID | Titre | Critère / Heuristique | Correctif | Statut |
|----|-------|-----------------------|-----------|--------|
| B1 | Pages légales | H10 / RGPD-like | `/conditions`, `/confidentialite`, `/accessibilite` (résume l'audit WCAG réel) — routes paresseuses, i18n fr/en | ✅ Terminé |
| B2 | Réinitialisation du mot de passe | H9 / Task-flow T2 | `forgot-password` (202 anti-énumération) + `reset-password` `[AllowAnonymous]`, `IEmailService` (stub journalisé), round-trip couvert en IT | ✅ Terminé |
| B3 | Admin réservations / locations / utilisateurs | — | Queries + commandes (transitions légales) ; pages clonées sur la data-table a11y ; tuiles du tableau de bord remplacent « Section en construction » | ✅ Terminé |
| B4-H1 | Confirmation du changement de langue | H1 | Marqueur `sessionStorage` + annonce `role="status"` polite à la locale servie (SSR-safe) | ✅ Terminé |
| B4-H5 | Vérification de disponibilité | H5 | `GET api/v1/auth/availability` + validateurs async debouncés (400 ms) sur l'inscription | ✅ Terminé |
| B4-FAQ | FAQ accessible | H10 | Accordéon `<details>/<summary>` sur `/installation` et `/location` (incl. « autres marques sauf ShelterLogic ») | ✅ Terminé |

> **Revue indépendante** (l'implémenteur ne valide pas son propre diff) : **APPROVE WITH NITS**
> (2 nits optionnels, non bloquants). Leçon capturée : **L-010** (une live-region ARIA globale casse
> les locators `getByRole` non scopés des specs sans rapport).
> **Vérification** : `dotnet test` UT 106 / IT 59 ✅ (intégration désormais en CI), `npm test` 100
> (zéro violation axe) ✅, `npm run e2e` 48 ✅.
> **Suite immédiate** : mini-cycle « marque/modèle sur `BookingSlot` + exclusion ShelterLogic »
> (Domain + migration EF), puis Épic C (adresse structurée + autocomplétion).

---

## Mise à jour — clôture de l'Épic C « Adresse structurée + autocomplétion accessible » (2026-06-13)

Branche `feat/address-split-autocomplete`. Boucle *architecte → développeur → revue indépendante → mentor*.

| ID | Titre | Critère / Heuristique | Correctif | Statut |
|----|-------|-----------------------|-----------|--------|
| C1 | Adresse structurée (numéro civique / appartement / rue) | WCAG 3.3.7 / 1.3.5 | Split du VO `Address` (`CivicNumber`/`Street`/`Apartment`), 4 owned-configs EF, migration `SplitAddressCivicNumber` (add-nullable → backfill T-SQL → NOT NULL sur owners requis, `Down()` re-concatène), `AddressDtoValidator` canonique unique appliqué aux 4 formulaires (code postal validé partout) | ✅ Terminé |
| C2 | Proxy Places (backend, provider-agnostique) | — | `IPlacesService` + `PlaceSuggestionDto` + queries CQRS `SuggestAddresses`/`LookupPostalCode` ; adaptateurs Photon (défaut, sans clé) / Radar / Google ; 1er `AddHttpClient` typé ; `PlacesController [AllowAnonymous]` + rate limiter `places` (30/10 s, prouvé 200+429) ; URL-encoding + base addresses épinglées (anti-SSRF), clés jamais exposées | ✅ Terminé |
| C3 | Autocomplétion accessible (APG combobox) | WCAG 1.3.1 / 2.1.1 / 4.1.2 | `shared/.../autocomplete` (role=combobox/listbox, `aria-activedescendant`, clavier flèches/Home/End/Enter/Escape, fermeture sur `focusout`, debounce 300 ms, `aria-live` résultats+chargement scopé, ≥44px, SSR-safe) ; `places.service.ts` ; câblé rue→autocomplete dans les 4 formulaires + lookup code postal **éditable** + `aria-live` « rempli automatiquement, vérifiez-le » | ✅ Terminé |
| C-fold | Marque/modèle d'abri + exclusion ShelterLogic | Règle métier (installation accepte d'autres marques) | `BookingSlot.Brand/Model` (nullables) + invariant `Create()` ; source canonique `Domain/Constants/ExcludedShelterBrands` (OrdinalIgnoreCase+trim) consommée par le validateur (422) **et** reflétée client (`brand.validators.ts`, test d'épinglage L-004) ; migration additive `AddBookingBrandModel` (nullable, `BookingSlots` seul) ; champ relié à la FAQ `install.marques` | ✅ Terminé |

> **Revue indépendante** : **REQUEST CHANGES** → corrigée. 1 bloquant : Photon (provider par défaut)
> renvoyait la province en nom complet (« Québec ») → 422 silencieux à la soumission (`AddressDtoValidator`
> `MaximumLength(2)`) ; corrigé par `CanadianProvinceCodes.Normalize` (nom FR/EN → code 2 lettres) +
> test de régression. 2 mineurs corrigés (fermeture combobox sur `focusout`, `track $index`). Le mock
> e2e masquait le décalage (forme déjà-conforme). **Leçons capturées : L-011** (adaptateurs d'un port
> doivent tous émettre le format canonique ; le mock imite le provider *par défaut*), **L-012** (e2e
> SSR+hydratation : `pressSequentially` + barrière `waitForResponse`), **L-013** (`input()` nommé
> d'après un attribut DOM global se reflète sur l'hôte) ; **L-004/L-010** affûtées.
> **Vérification** : `dotnet test` 226 ✅, `npm test` 115 (zéro violation axe) ✅, `npm run e2e` 56
> (0 flake, relancé 3×) ✅, `npm run build:prod` ✅, migrations eyeballées (L-001).
> **Suite** : Épic D — outil `/mesurer` parking (Leaflet + turf), réutilise l'autocomplétion C3 + lat/lng.

---

## Mise à jour — clôture de l'Épic D « Outil `/mesurer` + suggestions d'abri » (2026-06-13)

Branche `feat/mesurer-parking`. Boucle *architecte → développeur → revue indépendante (code-reviewer + solid-review) → mentor*.

| ID | Titre | Critère / Règle | Correctif | Statut |
|----|-------|-----------------|-----------|--------|
| D1 | Dimensions produit | Donnée métier | 3 `int?` `WidthCm/LengthCm/HeightCm` sur `Product` (scalaires, pas de VO owned) ; migration additive `AddProductDimensions` ; seeder dims Tempo ; `ProductDto` + 2 projections ; Create/Update + validateurs (null ou 50–2000) ; constante partagée `Domain/Constants/ProductDimensions` (L-004) ; champs admin a11y + i18n | ✅ Terminé |
| D2 | Endpoint `suggest-shelters` | — | `GET /api/v1/products/suggest-shelters?requiredWidthCm&requiredLengthCm` `[AllowAnonymous]` : dims non-null ∧ ≥ requis, tri empreinte croissante (tie-break nom), marges + `IsTightFit` (< `TightFitMarginCm`=50) ; validateur de query (>0 ∧ ≤2000) → 422 ; route littérale avant `{slug}` (verrouillée par IT) | ✅ Terminé |
| D3 | Feature `/mesurer` | WCAG 2.1.1 / 4.1.2 / 1.3.1 | Stepper signals Adresse (réutilise combobox C3 + lat/lng) → Mesure (calculateur véhicules **clavier** par défaut **ou** carte Leaflet+geoman+turf en `@defer`/`afterNextRender`, SSR-safe, `role="application"` pointer-only documenté) → Résultats (consomme D2, badge « Ajusté serré ») ; **cm-canonique + affichage en pieds** (`units.util` seul point de conversion, L-004) ; focus d'étape post-render (L-006) ; sweep axe dual-theme + `e2e/mesurer.spec.ts` | ✅ Terminé |

> **Revue indépendante** : **REQUEST CHANGES → corrigée**. 1 Major a11y : les sélecteurs de mode portaient `role="radio"` **sans le contrat APG** (roving tabindex + flèches) — AXE passait quand même au vert ; corrigé (util pur `radio-nav.util` + roving tabindex + flèches/Home/End déplacent ET sélectionnent, test clavier `toHaveFocus`). 1 Minor (message « hors plage » neutralisé) + nits. `solid-review` backend : **APPROVE WITH NITS** (validateurs scellés). **Leçons capturées : L-015** (`role=radio` sans roving/flèches cassé au clavier, invisible pour AXE ; focus synchrone post-`set` sûr si l'élément reste monté — contre-partie de L-006), **L-014** (`fb.control<number|null>`, jamais un tuple spread).
> **Vérification** : `npm test` 161 (zéro violation axe) ✅, `npm run build:prod` (fr+en, i18n OK, chunk `/mesurer` ~28 kB gz) ✅, `npm run e2e` `/mesurer` + sweep dual-theme ✅, `dotnet test` 274 ✅.
> **Suite** : Épic E — Redesign v2 (tokens v2, hero GSAP, viewer three.js — dimensionné depuis les dims produit D1).

---

## Mise à jour — Épic E « Redesign v2 » : sous-tâche E5 livrée (2026-06-13)

Branche `feat/redesign-v2`. E1→E4 déjà faits (commits locaux). E5 clôt l'implémentation de l'épic ; la **revue indépendante E1→E5 + le round-trip live** (frontière d'épic) restent à faire avant PR/merge.

| ID | Titre | Critère / Règle | Correctif | Statut |
|----|-------|-----------------|-----------|--------|
| E1 | Tokens v2 | — | Bloc additif `_tokens.scss` (échelles navy/rouge, couche « sur sombre/sur marque », élévation/dégradés, mouvement) | ✅ Terminé |
| E2 | Hero « scroll story » | CLS / 2.3.3 | GSAP `pin`+`scrub` (import dynamique `afterNextRender`, SSR-safe), repli `prefers-reduced-motion` | ✅ Terminé |
| E3 | Micro-interactions | 2.3.3 | Directives reveal/magnetic/count-up, loading-overlay, cursor-ring (pointeur fin only), navbar verre | ✅ Terminé |
| E4 | Viewer 3D abri | 4.1.2 / 2.5.8 | `three` vanilla, builder paramétrique (dims D1), `@defer (on interaction)`, repli statique sans WebGL | ✅ Terminé |
| E5 | Perf gates + remédiation contraste | 1.4.3 / perf | **Must-fix contraste** : jeton FIXE `--color-brand-on-dark #f87171` pour « Tempo »/icône navbar (était `--color-primary-light #dc2626` → 2.11:1 en clair) ; `.detail__view3d` (bouton « Voir en 3D ») recoloré pour surface claire (était blanc-sur-clair 1.1:1). `e2e/motion-a11y.spec.ts` (reduced-motion réel + axe dual-thème **navbar scrollée**) ; `reschedule.spec.ts` en scan **pleine page** ; bundle initial figé (gsap/three/leaflet lazy, `index.html` vérifié) ; gate Lighthouse documenté **manuel/non bloquant**. | ✅ Terminé |

> **Vérification (E5)** : `netstat` ports e2e propres (pas de serveur zombie, L-017) ✅ ; `npm run build` (typecheck) ✅ ; `npm test` **196** — zéro violation axe vitest, *mais `color-contrast` NON couvert ici par conception (L-016) ; contraste validé en e2e* ✅ ; `npm run build:prod` (budgets OK, `index.html` sans `<script>` lib lourde) ✅ ; `npm run e2e` **suite complète 71 passées** (dont `motion-a11y` 8/8, `admin-management` — les 3 scans « clair » jadis à 2.11:1 repassent —, `reschedule` pleine page, `shelter-3d`) ✅.
> **Écart au plan** : le balayage dual-thème e2e a révélé **une seconde** violation de contraste que le constat de l'architecte (« une seule violation ») ne couvrait pas — `.detail__view3d` (blanc sur clair, 1.1:1) : corrigée dans le même lot. C'est précisément l'intérêt de faire tourner le scan complet (L-005/L-008).
> **Suite** : frontière d'épic E — revue indépendante `code-reviewer` (E1→E5) + round-trip live L-001 (reduced-motion ON/OFF, deux thèmes, verre au scroll, cursor-ring, viewer 3D) → revue → commit → PR → CI → merge `master`.

---

## Mise à jour — suivis heuristiques F2-B/F2-C livrés + défaut geoman tracké (2026-06-14)

Branche `fix/f2-heuristics-followup` (post-programme, hors-épic). Boucle *développeur → revue indépendante `code-reviewer` (APPROVE WITH NITS, nits clôturés) → mentor*. Clôt les deux derniers constats mineurs de la passe heuristique F2 ; un **troisième défaut (F2-D, sév. 3)** a été **découvert** par la garde de test ajoutée pour F2-B et reste un suivi ouvert.

| ID | Titre | Critère / Règle | Correctif | Statut |
|----|-------|-----------------|-----------|--------|
| F2-B | `/mesurer` carte « adresse non localisée » | H2/H5 · 3.3.x | Indice visible persistant quand `lat/lng` null (`computed notLocated()` pur, SSR-safe, `aria-describedby` du canvas, pas de live-region) ; i18n fr/en équilibrés ; spec vitest non vacue ; contraste validé e2e dual-thème (L-016) | ✅ Terminé |
| F2-C | Dédup `.btn--small`/`.btn--danger` | H4 cohérence | Promotion au global `styles.scss` (valeurs verbatim, cible 44px préservée) ; 3 copies scopées supprimées ; effet de bord positif : bouton danger de `account/rentals` enfin stylé (≈5.9:1, axe dual-thème) ; coexistence `--small`/`--sm` documentée (L-020) | ✅ Terminé |
| Bug-08(F2-D) | `/mesurer` : dessin sur carte non fonctionnel — `map.pm` (geoman) ne s'attache pas | 4.1.2 / fonctionnel | ✅ **Corrigé** (branche `fix/f2d-mesurer-geoman-draw`). Vraie cause (≠ hypothèse CJS/ESM initiale) : geoman est un **IIFE qui lit `L` en variable libre via `globalThis.L`** (n'importe pas Leaflet) **et** attache `map.pm` par un `L.Map.addInitHook` qui ne s'exécute que pour les cartes construites **après** son chargement. Fix couplé : `globalThis.L = L` **puis** import geoman **avant** `L.map(...)` (dans `afterNextRender`, SSR-safe). Garde `test.fixme` → `test` actif (capacité `.leaflet-pm-toolbar.leaflet-pm-draw` + bouton rectangle/polygone). Diagnostic supersédé tracé en **L-021** (L-019 corrigée) | ✅ Terminé |
| Flake-01 | `a11y.spec.ts` Boutique : `aria-prohibited-attr` intermittent | 4.1.2 | `<div class="catalog__grid" aria-busy aria-label>` sans `role` pendant le chargement → `role="status"` ou retirer l'`aria-label` du `div` sans rôle (`catalog.html`). Préexistant (confirmé via `git stash`), non lié à F2 | 🟠 Ouvert (suivi) |

> **Revue indépendante** : **APPROVE WITH NITS** sur `master..HEAD` — zéro Critical/Major. 2 Nits (chiffre de contraste rectifié 6.8→5.9:1 ; commentaire `--color-danger` « jeton fantôme » → couleur de marque fixe) + 2 Minor (effet de bord visuel `account/rentals` mentionné ; garde geoman positive ajoutée) **clôturés** dans le 3e commit. **Leçons capturées : L-019** (tester la capacité derrière un import dynamique lourd, pas l'enveloppe ; `vi.mock` n'intercepte pas les deps pré-bundlées) **et L-020** (prouver qui atteint une classe scopée avant de dédupliquer).
> **Vérification** : `netstat` ports e2e propres (L-017) ✅ ; `npm run build` (typecheck) ✅ ; `npm test` **202** (zéro violation axe vitest — `color-contrast` non couvert, L-016) ✅ ; `npm run build:prod` (initial 499,71 kB, budgets OK, libs lourdes lazy) ✅ ; `npm run e2e` specs touchées **5 passées + 1 `fixme`** (geoman) — scans `color-contrast` du bouton danger **OK clair ET sombre** ✅.
> **Suite** : `fix/f2-heuristics-followup` → revue → commit docs → PR → CI → merge `master`. **F2-D (geoman) et Flake-01 (catalog)** : suivis ouverts, à planifier en cycles dédiés (F2-D mérite une vérif live L-001 dev-vs-prod).

---

## Mise à jour — F2-D corrigé : carte `/mesurer` dessinable (geoman `map.pm`) (2026-06-14)

Branche `fix/f2d-mesurer-geoman-draw` (cycle dédié, post-programme). Boucle *architecte → développeur → revue indépendante `code-reviewer` (APPROVE WITH NITS, nits clôturés) → mentor*. Clôt le défaut **F2-D (sév. 3)** découvert pendant F2-B.

**Cause réelle (≠ hypothèse initiale).** Le pointeur supposait une interop CJS/ESM (geoman patchant une *autre* instance Leaflet). L'analyse statique du dist (`@geoman-io/leaflet-geoman-free@2.19.3`) + une sonde live `window.ng.getComponent()` ont montré deux causes couplées : (1) geoman est un **IIFE esbuild qui n'importe PAS Leaflet** (0 require/import, 463 réfs `L.`) — il lit `L` en **variable libre depuis `globalThis.L`**, jamais exposé par le composant (import ESM local) → `globalThis.L` undefined → geoman ne patche rien ; (2) même après avoir posé le global, `map.pm` restait null car geoman attache `pm` via un **`L.Map.addInitHook`** qui ne s'exécute que pour les cartes construites **après** son chargement — or la carte était créée **avant** l'import geoman.

**Correctif** (`map-measure.ts`, dans `afterNextRender`, SSR-safe) : `globalThis.L = L` **puis** `import('@geoman-io/leaflet-geoman-free')` **avant** `L.map(...)` (turf chargé après, inchangé). Garde défensive `if (!pm) return;` conservée (L-019). E2E : `test.fixme` → `test` actif, assertion de **capacité** `.leaflet-pm-toolbar.leaflet-pm-draw` + bouton rectangle/polygone (geoman rend 2 barres → cible la barre de dessin pour lever l'ambiguïté strict-mode, sans affaiblir). **Compromis assumé** : le paint du conteneur est désormais gated sur le chunk geoman (~360 kB) puisque geoman doit charger avant la construction — inévitable et acceptable (carte `@defer on immediate`).

> **Revue indépendante** : **APPROVE WITH NITS** — zéro Critical, 1 Major (commentaire smoke périmé contredisant le fix, L-008) + nits, **tous clôturés** (commentaire e2e réécrit ; doc `@defer on viewport`→`on immediate` corrigée ×2). **Leçon L-021** capturée (plugin `addInitHook` : importer avant construction + `globalThis.L` ; sonder la capacité sur l'instance vivante, pas seulement le global) ; **L-019 corrigée** (ancien diagnostic CJS/ESM marqué supersédé).
> **Vérification** : `netstat` ports e2e propres (L-017) ✅ ; `npm run build` (typecheck) ✅ ; `npm test` **202** (zéro violation axe vitest) ✅ ; `npm run build:prod` (geoman reste chunk lazy 359,97 kB, hors bundle initial) ✅ ; `npm run e2e` **73 passées / 0 échec** — le test ex-`fixme` « CARTE dessinable » passe (barre geoman + bouton de dessin visibles), smoke + parcours clavier verts. *Note L-001 : vérif live faite côté dev (vite, 4200) via sonde avant/après ; le fix est runtime/bundler-agnostique (ordre d'import, pas une astuce vite-vs-esbuild) → attendu identique en prod, `build:prod` confirmé compilant.*
> **Suite** : ✅ **mergé vers `master` — PR #23 (`a57ed5e`)**, branche supprimée, CI verte. Reste ouvert : **Flake-01 (catalog)** + redéploiement prod (gated secret).

---

## Mise à jour — D4/D5 livrés : carte centrée sur l'adresse + zone de service (2026-06-15)

Branche `feat/epic-d-address-unified` (Épic D, suite de D1–D3). **D4** : la carte `/mesurer` se centre désormais sur l'adresse réelle même sans choix de suggestion — `submit()` géocode (réutilise `places/suggest`, 1re entrée) avant d'émettre lat/lng ; `map.setView(zoom 20)` + `invalidateSize()` au montage `@defer` ; repli `SERVICE_BASE` (plus de littéral Gatineau en dur). **D5** : avertissement **doux, NON bloquant** « hors zone de service (~100 km) » (`role="status"`, mesure toujours possible) ; socle serveur `GeoDistance` (Haversine + base/rayon, **miroir** de `service-area.util.ts`, L-007/L-004) **sans** `RuleFor` distance (évite la régression « → 422 » L-004 §C1) ; test serveur de **non-rejet** d'une adresse hors-zone.

| ID | Constat | WCAG / réf | Statut |
|----|---------|-----------|--------|
| Bug-09 | `/mesurer` étape Résultats : badge « Ajusté serré » (`.shelter-card__badge`) illisible en **thème sombre** — `#fff` sur `--color-warning` amber `#fbbf24` = **1.66:1** (< 4.5:1) | 1.4.3 contraste | 🟠 **Ouvert (suivi)** — **préexistant** (résultats-step non touché par D4/D5 ; clean `git status`), **découvert** par le scan axe dual-thème ajouté pour D5. Invisible jusqu'ici car aucun e2e ne balayait `/mesurer` résultats en thème sombre (famille L-016). Correctif attendu : fond amber **fixe** + texte **sombre fixe** (le fond ne doit pas basculer de clarté par thème — cousin L-023). Hors périmètre D4/D5 : à planifier en cycle dédié |

> **Vérification** : `netstat` ports e2e propres (L-017) ✅ ; backend `dotnet test` **211 unit + 72 integration / 0 échec** (7 `GeoDistanceTests` + non-rejet hors-zone) ✅ ; `npm run build` (typecheck) ✅ ; `npm test` **234 / 0 échec** (service-area Haversine/seuil, address-step géocode mocké, measure-step avertissement) — zéro violation axe vitest (`color-contrast` non couvert, L-016) ✅ ; `npm run i18n:extract` — 2 nouveaux ids (`mesurer.address.geocoding`, `mesurer.address.outOfZone`) **symétriques** dans `messages.xlf` + `messages.en.xlf` (L-018), `build:i18n` bilingue OK ✅ ; `npm run e2e mesurer` **6 / 0 échec** — **D4 centrage capacité** via `window.ng.getComponent()` (lat/lng = valeurs géocodées, **pas** Gatineau, L-019) ; **D5 dual-thème** sur l'étape mesure (contraste de l'avertissement OK clair **et** sombre) + mesure jusqu'aux résultats non bloquée ✅.
> **Suite** : revue indépendante `code-reviewer` → commit → PR → CI → merge. **Bug-09** : suivi ouvert (cycle dédié).

---

## ✅ Épic D — Système d'adresse unifié : CLÔTURÉ (2026-06-15)

Branche `feat/epic-d-address-unified` — 3 commits (`240e46a` D1–D3, `6354645` D4–D5, `997feaf` D6). Boucle complète *architecte → développeur (1 à la fois) → revue indépendante `code-reviewer` à la frontière d'épic → mentor*. **Décisions utilisateur figées respectées** : champ adresse intelligent → champs structurés éditables ; deux choix d'adresse connecté (pastille profil **ou** parcours anonyme).

| ID | Sous-tâche | Statut |
|----|-----------|--------|
| D1 | N° civique préservé quand la suggestion Photon n'en fournit pas (cascade `s.civicNumber \|\| parseCivicFromLabel(label) \|\| valeur saisie`) | ✅ |
| D2 | Code postal : `applySuggestion` retourne `PostalFillResult` (`filled`/`unavailable`), court-circuit sans réseau si la suggestion porte déjà le code, feedback `aria-live` dans les 4 formulaires | ✅ |
| D3 | Province/ville verrouillées par tests (province ≠ défaut + fallback QC) ; normalisation 2-lettres reste côté serveur (`CanadianProvinceCodes`), **aucune** whitelist (L-004 §C1) | ✅ |
| D4 | Carte `/mesurer` centrée sur l'adresse géocodée (`PlacesService.geocode` + `invalidateSize`) — plus de repli silencieux sur Gatineau | ✅ |
| D5 | Zone de service 100 km : avertissement **doux non bloquant** (`role="status"`) ; util client `service-area.util` + Domain `GeoDistance` **miroir** (L-007) ; test serveur de **non-rejet** | ✅ |
| D6 | Composant partagé `app-address-choice` (pastille `role="group"` lecture seule **ou** bascule `<ng-content>` vers le parcours anonyme) câblé sur les 4 écrans ; focus post-rendu L-006 + `aria-live` scopée L-010 ; parcours anonyme strictement inchangé quand `profileAddress` est null | ✅ |

> **Revue indépendante `code-reviewer`** (diff `master..HEAD`) : **APPROVE WITH NITS** — zéro Critical/Major ; miroir client↔serveur `45.4765/-75.7013/100` vérifié identique + verrou bilatéral ; warning non bloquant confirmé (aucun `RuleFor` distance) ; SOLID `GeoDistance` OK (pur Domain) ; focus L-006/live-region L-010/44px/dual-thème tenus. 2 nits optionnels non bloquants (setup de spec à resserrer ; duplication du câblage `addressMode` sur 4 écrans = dette future).
> **Mentor** : **L-026** (wrapper `<ng-content>` derrière `@if/@else` masque les champs en mode pastille + route auth-gardée intestable anonymement) et **L-027** (live-region pilotée par signal ne ré-annonce pas une valeur identique → repasser par un état neutre) capturées ; **L-016** affûtée (composant à fond teinté → contraste vérifié en axe e2e dual-thème).
> **Gates finales** : `npm run build` ✅ · `npm test` **244 / 0** ✅ · `npm run i18n:extract` (9 ids `address.*`/`mesurer.address.*` symétriques) ✅ · `npm run e2e` (address-choice 10 + régression dual-thème, 0 axe) ✅ · `dotnet test` **211 + 72 / 0** ✅.
> **Suite** : PR `feat/epic-d-address-unified` → `master` → CI verte → merge (prod auto-déployée). **Reste ouvert** : Bug-09 (badge sombre, cycle dédié) ; **Épic E** (parcours premier utilisateur) = prochain épic du Programme G.

---

**✅ Épic E (parcours premier utilisateur) MERGÉ** — PR #37 (`233a388`), CI verte. E1 redirection profil (verrou e2e) + E2 alerte adresse 1re connexion (scopée profil, sans migration). **Reste ouvert** : Bug-09 (badge sombre) ; bug contraste onglet actif profil sombre 2.76:1 (préexistant, découvert en Épic E) ; **Épic F** (accès invité) = prochain.

---

---

## 🔵 Mise à jour — Épic G « Catalogue marques/modèles + fit mesurer » : PR ouverte (2026-06-16)

Branche `feat/epic-g-catalog` — 3 commits feature (G1 `d19512f`, G2 `443afce`, G3 `fd693c2`) + 1 commit docs (L-030/L-031). Boucle complète *architecte → développeur → revue indépendante `code-reviewer` + `solid-review` → mentor*. PR ouverte, CI en cours.

| ID | Sous-tâche | Statut |
|----|-----------|--------|
| G1 | `Brand`/`Model` `string?` sur `Product` (idiome miroir `BookingSlot`, pas d'entité séparée) + factory `Create`/`SetBrandModel` + config EF `nvarchar(100)` + migration **`AddProductBrandModel`** (`20260616154411`, `MigrateOnStartup` OFF L-022) + seeder enrichi (« Abris Tempo » + modèles sur 8 abris réels) + propagation commands/handlers/validators (`MaximumLength(100)`, optionnels) + projections `ProductDto` + sync `product.model.ts` + tests Create/Update | ✅ |
| G2 | Endpoint `GET /api/v1/products/shelter-catalog` (`[AllowAnonymous]`, route littérale avant `{slug}`) + `GetShelterCatalogQuery`/handler/DTOs (`.ThenBy(Slug)` déterministe **L-030**) + 2 IT ; frontend selects marque→modèle dans `features/installation` (dimensions lecture seule, repli catalogue vide, garde `excludedBrand` conservée) + service/modèle TS + 9 ids i18n symétriques fr/en | ✅ |
| G3 | Carte `/mesurer` agrandie (breakout CSS hors `.container--narrow` + `ResizeObserver`→`invalidateSize`, teardown `DestroyRef`, SSR-safe) ; **cause racine du fit cassé = base dev périmée** (seeder idempotent jamais rétro-rempli) → **backfill idempotent par slug/par champ** (préserve saisie admin, gardé par `ProductSeederBackfillTests`) ; `Brand`/`Model` exposés dans `ShelterSuggestionDto` + projection + affichage `results-step` | ✅ |

> **Revue indépendante** (`code-reviewer` + `solid-review` backend) : **APPROVE** — 10 points vérifiés, zéro bloquant. Leçons capturées : **L-030** (`.ThenBy` + `.First()` déterministe sur tri non-unique — tri secondaire obligatoire dès qu'un tri primaire peut produire des ex-æquo entre appels), **L-031** (seeder idempotent + colonne ajoutée après semis initial = backfill idempotent par champ côté seeder, pas de migration de données, gardé par `ProductSeederBackfillTests`).
> **Gates finales** : `dotnet test` **328/0** (250 unit + 78 IT) ✅ · `npm run build` ✅ · `npm test` **262/262** ✅ · `npm run e2e` mesurer 6/6 + installation 2/2 ✅ · i18n symétrique ✅ · round-trip live LocalDB (catalogue + suggest-shelters []→6 candidats, L-001) ✅.
> **Suite** : CI verte → merge `master` (prod auto-déployée). **Prochain : Épic H** — déploiement manuel (région SWA Canada + provisioning backend Azure Container Apps + Azure SQL S0).

---

**✅ Épic F (accès invité — compte express silencieux) MERGÉ** — PR #38 (`e536cd2`, merge `--admin`), branche `feat/epic-f-guest-checkout` supprimée. Un visiteur **non connecté** peut acheter / louer / réserver ; à la confirmation il saisit nom/prénom/courriel/tél ; un **compte express passwordless** (`AppUser.IsExpress`, rôle `Customer`, migration `AddIsExpressToAppUser`) est **trouvé-ou-créé par courriel** → `CustomerId` réel partout, **aucun JWT émis** sur le parcours invité. Backend : `GuestContact` + `GuestContactValidator` + port `IExpressAccountService` (Application) / impl via `UserManager` (Infrastructure) ; les 3 commandes (`PlaceOrder`/`CreateRentalContract`/`CreateBooking`) reçoivent `GuestContact?` + `When(...)` + résolution `userId = connecté ?? express` ; `[AllowAnonymous]` sur les 3 POST de création (sœurs `GetMine`/`Cancel`/admin restent protégées). Frontend : composant réutilisable `app-guest-contact` (OnPush/signals/reactive, a11y labels+`aria-describedby` conditionnel+`role=alert` scopé, i18n `@@guestContact.*`), retrait `authGuard` de `panier/caisse` + retrait des gardes/redirections `/auth` impératives (cart/location/installation) + redirection post-succès invité→`/`. **Revue indépendante `code-reviewer` : APPROVE WITH NITS** (zéro bloquant ; sécurité passwordless+sibling-actions vérifiée ; non-régression `PlaceOrderCommandValidatorTests` Ontario→pass intacte L-004 ; nit `aria-describedby` conditionnel appliqué). **Mentor : L-028** (revue sécurité bipartite d'un endpoint `[AllowAnonymous]` : reachability JWT + couverture des actions sœurs) **et L-029** (retirer le `authGuard` de route ≠ suffisant — traquer gardes impératifs + navigations post-action vers routes protégées) capturées. **Gates** : `dotnet test` **315 / 0** (32 nouveaux Épic F) ✅ · `npm run build` ✅ · `npm test` **261 / 0** (guest-contact 5/5, 0 axe) ✅ · `npm run e2e` checkout-guest **2/2** (Ontario+QC) + non-régression 11 + a11y dual-thème 30 (0 axe) ✅ · i18n catalogues symétriques (10 ids ajoutés, 3 orphelins purgés). **Note CI** : les 3 gates de code (Backend / Frontend / SonarCloud) **verts** ; seul `Build & Deploy` (SWA) rouge sur un **rate-limit MCR externe** (429, incident Microsoft Container Registry) → merge `--admin` autorisé par l'utilisateur ; **déploiement prod en attente de récupération MCR** (re-run manuel `gh run rerun 27580207119 --failed` plus tard). **Reste ouvert** : Bug-09 (badge sombre) ; contraste onglet actif profil sombre 2.76:1 ; **Épic G** (catalogue marques/modèles + fit mesurer) = prochain.
