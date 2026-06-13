# Program status — pointeur de reprise

> **But.** Fichier de reprise unique pour le programme « Compléter + Adresse + Mesurer + Redesign 10k ».
> Quand une session redémarre (gestion du contexte), dis simplement **« continue la prochaine tâche »**
> ou lance **`/next-task`** : l'assistant lit ce fichier + le plan, vérifie l'état git, puis enchaîne.
>
> **Plan complet (6 épics A→F) :** `C:\Users\phili\.claude\plans\1-i-want-you-glistening-barto.md`
> Maintiens ce pointeur à jour à la fin de chaque sous-tâche (c'est ce que l'assistant relit).

---

## Curseur courant

- **Épic en cours :** **Épic E — Redesign v2** (branche `feat/redesign-v2` — créée depuis `master` post-merge D, active). Voir le plan (Épic E) : E1 tokens v2 (absorbe le bloc A) → E2 hero scroll story (GSAP, `gsap.matchMedia` reduced-motion, SSR frame 1) → E3 micro-interactions (directives reveal/magnetic/count-up, loading-overlay, cursor-ring) → E4 viewer 3D (`three`, builder paramétrique dimensionné depuis les dims produit D1, `@defer (on interaction)`) → E5 perf gates (bundle initial figé, `e2e/motion-a11y.spec.ts`, Lighthouse). **Contrainte : E4 dépend de D1 (✅ livré).**
- **Prochaine sous-tâche :** **E2 — Hero scroll story** (`features/home/hero-story/`) : dép `gsap` (libre, ScrollTrigger inclus) ; SVG superposé inline (sol/ancrage → structure tubulaire → toile → neige + véhicule), épinglé ~3 viewports, scrub, beats de texte ; `gsap.matchMedia('(prefers-reduced-motion: reduce)')` → scène finale statique, pas d'épinglage ; `import('gsap')` dynamique dans `afterNextRender` ; SSR rend la frame 1 (LCP) avec hauteur de pin-spacer pré-allouée (CLS-safe). **Lenis : écarté** (risque a11y scroll-hijack). Consomme les tokens de mouvement E1. **Gate = axe dual-theme à zéro + pas de régression CLS.**
- **E1 — Tokens v2 : ✅ FAIT (commit local `cdd82a4`, non encore mergé)** — bloc additif « Tokens v2 — Épic E / E1 » dans `_tokens.scss` (échelles navy/rouge, neutres chauds, couche sémantique sur-sombre/sur-marque qui tue les hacks de bouton, élévation/dégradés/lueurs, tokens de mouvement) + balayage `styles.scss`/`home.scss`/`navbar.scss`. Bloc Épic A conservé. Constantes inter-thèmes AA (focus, feedback fond clair, accents navbar) laissées littérales (R3/L-004). Gates : `npm test` **161** (zéro axe, 2 thèmes) ✅ · `build:prod` ✅ · `e2e` ✅. **Pas de revue indépendante** (sous-tâche intermédiaire — revue complète à la frontière d'épic, préférence crédits).
- **Épic D : ✅ TERMINÉ ET MERGÉ vers `master`** — **PR #17 mergée (`fa8852b`)**, branche `feat/mesurer-parking` supprimée, CI verte (Frontend/Backend/Build&Deploy/Sonar). Détail ci-dessous.

### Épic D — ✅ TERMINÉ (revu, branche `feat/mesurer-parking`)

| Sous-tâche | État | Commits |
|-----------|------|---------|
| D1 — Dimensions produit (`WidthCm/LengthCm/HeightCm` + migration `AddProductDimensions` + seeder + projections + Create/Update validators + constante `ProductDimensions`) | ✅ | `a526d90` |
| D2 — Endpoint `suggest-shelters` (filtre dims ≥ requis, tri empreinte, marges + `IsTightFit`, validator >0∧≤2000) | ✅ | `b3408f0` |
| D3 — Feature `/mesurer` (stepper Adresse→Mesure→Résultats ; calculateur clavier ou carte Leaflet/geoman/turf `@defer` SSR-safe ; **cm-canonique + affichage en pieds** `units.util` ; radiogroups **APG** `radio-nav.util`) | ✅ | `01983b4` |
| Correctifs revue indépendante (radiogroups APG roving tabindex+flèches, wording, sealed, modifier-keys) | ✅ | `53d99fd`, `88fa70a`, `bd8381d` |

**Revue indépendante** : `code-reviewer` **REQUEST CHANGES → corrigée** (1 Major a11y : `role=radio` sans contrat APG, invisible pour AXE) ; `solid-review` backend **APPROVE WITH NITS** (validateurs scellés). **Leçons capturées : L-015** (APG roving tabindex ; focus synchrone post-`set` sûr si élément monté — contre-partie L-006) **et L-014** (`fb.control<number|null>`, jamais un tuple spread).
**Gates finales** : `npm test` **161** (zéro axe) ✅ · `npm run build:prod` (fr+en, i18n OK, chunk `/mesurer` ~28 kB gz) ✅ · `npm run e2e` `/mesurer` (clavier + smoke carte) + sweep dual-theme ✅ · `dotnet test` **274** ✅. *(Flake connu : 1er run e2e à froid → `vite-error-overlay` transitoire du dev-server ; vert au re-run warm + retries CI.)*
**Décision produit pliée** : **cm-canonique + affichage en pieds** — tout le calcul/API en cm ; les pieds ne servent qu'à la saisie (`feetToCm`) et à l'affichage (`cmToFeet`, « pi »/« ft », 1 décimale). Saisie manuelle en pieds (1–65 pi).
**Docs retournées** : `board.md` (clôture Épic D), `product-backlog.md` (US-1.7), README roadmap, `wcag-2.2-audit.md` (4.1.2 radiogroup APG).
**Statut git** : **PR #17 mergée vers `master` ✅ (`fa8852b`)**, branche supprimée. CI verte (4 correctifs e2e/CI après la 1re revue : APG, `@defer on immediate`, carte avant geoman, **interop CJS/ESM Leaflet `L.map`**).

- **Dernière mise à jour :** 2026-06-13 (E1 tokens v2 fait — commit local `cdd82a4` ; curseur → E2 hero scroll story)

### Épic C — ✅ TERMINÉ (branche `feat/address-split-autocomplete`)

| Sous-tâche | État | Commits |
|-----------|------|---------|
| C1 — Split Address VO + migration + validateur canonique | ✅ revu | `5e97441`, `983ed1f`, `d37556a` |
| C2 — Proxy Places (Photon/Radar/Google + rate limiter) | ✅ revu | `53175c3` |
| C3 — Autocomplete accessible (APG combobox) + 4 formulaires | ✅ revu | `8183d46`, flake fix `6e23b48` |
| Fold-in marque/modèle + exclusion ShelterLogic | ✅ revu | `80b0c37` |
| Correctifs de revue indépendante (Photon province, focusout, track) | ✅ | `2c963f7` |

**Revue indépendante** : REQUEST CHANGES → corrigée (1 bloquant Photon province nom→code 2 lettres + 2 mineurs). **Leçons capturées par le `mentor` : L-011, L-012, L-013** (+ L-004/L-010 affûtées). Migrations `SplitAddressCivicNumber` (`20260613033910`) et `AddBookingBrandModel` (`20260613051112`) appliquées sur LocalDB + eyeballées (L-001).
**Gates finales** : `dotnet test` 226 ✅ · `npm test` 120 (zéro axe) ✅ · `npm run e2e` 56 (0 flake, ×3) ✅ · `build:prod` ✅. Gate Sonar : duplication new-code ramenée 6.8 %→<3 % via `AddressAutofillService` (`b3e8f27`).
**Statut git :** **PR #16 mergée vers `master` ✅ (`36097f4`)**, branche supprimée. Docs retournées : `board.md`, `product-backlog.md` (US-2.8/2.9), README roadmap, `wcag-2.2-audit.md` (1.3.5 / 4.1.2).

## Épic B — TERMINÉ (branche `feat/missing-sections`)

| Sous-tâche | État | Notes |
|-----------|------|-------|
| B1 — Pages légales | ✅ | `47d306f` |
| B2 — Réinitialisation mot de passe bout-en-bout | ✅ | `52a9064`, `c54782d` |
| B3 — Admin réservations / locations / utilisateurs | ✅ | `3e4c174` `f43fbe4` `bcaa95e` `d268b82` |
| #11 — Correctifs de revue B1/B2 | ✅ | `478a711` (parité mot de passe L-004, IT en CI L-005, a11y) |
| B4 — Heuristiques (H1 langue, H5 disponibilité, FAQ) | ✅ | revue indépendante APPROVE WITH NITS ; leçon L-010 |

Docs retournées : README roadmap, `docs/agile/board.md` (section clôture Épic B),
`docs/ux/heuristic-evaluation.md` (H1–H10 tous remédiés). **PR #15 mergée vers `master` ✅ (`7ccec41`).**

## Suite du programme

- **Épic C** — ✅ TERMINÉ — Adresse structurée + autocomplétion accessible (proxy Photon/Radar/Google) — `feat/address-split-autocomplete`
- **Épic D** — Outil `/mesurer` parking + suggestions (Leaflet + turf) — `feat/mesurer-parking` — **← prochain**
- **Épic E** — Redesign v2 (tokens v2, GSAP hero, three.js viewer) — `feat/redesign-v2` — *après D*
- **Épic F** — Wrap-up docs/process — `docs/program-wrapup`

Détail complet de chaque épic : voir le fichier de plan référencé en tête.
Règle git de fin d'épic : revue → commit → PR → revue CI → merge/push `master`.
