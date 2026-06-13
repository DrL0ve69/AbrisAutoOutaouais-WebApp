# Program status — pointeur de reprise

> **But.** Fichier de reprise unique pour le programme « Compléter + Adresse + Mesurer + Redesign 10k ».
> Quand une session redémarre (gestion du contexte), dis simplement **« continue la prochaine tâche »**
> ou lance **`/next-task`** : l'assistant lit ce fichier + le plan, vérifie l'état git, puis enchaîne.
>
> **Plan complet (6 épics A→F) :** `C:\Users\phili\.claude\plans\1-i-want-you-glistening-barto.md`
> Maintiens ce pointeur à jour à la fin de chaque sous-tâche (c'est ce que l'assistant relit).

---

## Curseur courant

- **Épic en cours :** **Épic D — Outil `/mesurer` parking + suggestions d'abri** (branche à créer : `feat/mesurer-parking`)
- **Prochaine sous-tâche :** **D1 — Dimensions produit** (3 `int?` `WidthCm`/`LengthCm`/`HeightCm` sur `Product`, migration additive `AddProductDimensions`, seeder dims Tempo réelles, DTO + projection GetAll + Create/Update + champs admin). Voir le plan (Épic D) pour D2 (endpoint `suggest-shelters`) et D3 (feature `/mesurer` : Leaflet + turf + calculateur véhicule).
- **Pré-requis Épic D déjà satisfait :** l'autocomplétion C3 (rue + lat/lng dans `PlaceSuggestionDto`) est livrée et réutilisable par l'étape « Adresse » du `/mesurer`.
- **Dernière mise à jour :** 2026-06-13

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
