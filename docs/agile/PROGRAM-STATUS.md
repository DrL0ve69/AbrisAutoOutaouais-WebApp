# Program status — pointeur de reprise

> **But.** Fichier de reprise unique pour le programme « Compléter + Adresse + Mesurer + Redesign 10k ».
> Quand une session redémarre (gestion du contexte), dis simplement **« continue la prochaine tâche »**
> ou lance **`/next-task`** : l'assistant lit ce fichier + le plan, vérifie l'état git, puis enchaîne.
>
> **Plan complet (6 épics A→F) :** `C:\Users\phili\.claude\plans\1-i-want-you-glistening-barto.md`
> Maintiens ce pointeur à jour à la fin de chaque sous-tâche (c'est ce que l'assistant relit).

---

## Curseur courant

- **Épic en cours :** **B terminé ✅** → prochain : **mini-cycle « marque/modèle »**, puis **Épic C**
- **Prochaine sous-tâche :** **Mini-cycle marque/modèle + exclusion ShelterLogic** (Domain + migration EF)
- **Dernière mise à jour :** 2026-06-13

## Prochaine tâche — mini-cycle « marque/modèle » (règle métier reportée de B4)

Le catalogue reste **100 % Tempo**, mais le **service d'installation accepte d'autres marques**.
À livrer (son propre cycle, sa propre revue — c'est une modif Domain, « ne pas toucher Domain à la légère ») :
1. **Champs marque/modèle** sur `BookingSlot` (`Brand`, `Model`) + sur `CreateBookingCommand` (DTO + validateur).
2. **Exclusion ShelterLogic** appliquée **client ET serveur** (L-004 : un format/règle partagé = UNE définition).
3. **Mini-migration EF** additive (champs nullables — respecter la nullabilité des owned, L-001) ;
   eyeball `dotnet ef migrations script`.
4. La ligne FAQ « on installe d'autres marques sauf ShelterLogic » existe déjà (texte, livré en B4) —
   la relier au champ une fois capturé.
> ⚠️ Si tu préfères, ce mini-cycle peut être **sauté** et fusionné dans l'Épic C — à confirmer.

## Épic B — TERMINÉ (branche `feat/missing-sections`)

| Sous-tâche | État | Notes |
|-----------|------|-------|
| B1 — Pages légales | ✅ | `47d306f` |
| B2 — Réinitialisation mot de passe bout-en-bout | ✅ | `52a9064`, `c54782d` |
| B3 — Admin réservations / locations / utilisateurs | ✅ | `3e4c174` `f43fbe4` `bcaa95e` `d268b82` |
| #11 — Correctifs de revue B1/B2 | ✅ | `478a711` (parité mot de passe L-004, IT en CI L-005, a11y) |
| B4 — Heuristiques (H1 langue, H5 disponibilité, FAQ) | ✅ | revue indépendante APPROVE WITH NITS ; leçon L-010 |

Docs retournées : README roadmap, `docs/agile/board.md` (section clôture Épic B),
`docs/ux/heuristic-evaluation.md` (H1–H10 tous remédiés). **PR/merge vers `master` en cours.**

## Suite du programme (après le mini-cycle)

- **Épic C** — Adresse structurée (civic/apt/rue) + autocomplétion accessible (proxy Photon/Radar/Google) — `feat/address-split-autocomplete`
- **Épic D** — Outil `/mesurer` parking + suggestions (Leaflet + turf) — `feat/mesurer-parking` — *après C*
- **Épic E** — Redesign v2 (tokens v2, GSAP hero, three.js viewer) — `feat/redesign-v2` — *après D*
- **Épic F** — Wrap-up docs/process — `docs/program-wrapup`

Détail complet de chaque épic : voir le fichier de plan référencé en tête.
Règle git de fin d'épic : revue → commit → PR → revue CI → merge/push `master`.
