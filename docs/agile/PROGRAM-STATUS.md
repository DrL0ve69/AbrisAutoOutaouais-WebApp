# Program status — pointeur de reprise

> **But.** Fichier de reprise unique pour le programme « Compléter + Adresse + Mesurer + Redesign 10k ».
> Quand une session redémarre (gestion du contexte), dis simplement **« continue la prochaine tâche »**
> ou lance **`/next-task`** : l'assistant lit ce fichier + le plan, vérifie l'état git, puis enchaîne.
>
> **Plan complet (6 épics A→F) :** `C:\Users\phili\.claude\plans\1-i-want-you-glistening-barto.md`
> Maintiens ce pointeur à jour à la fin de chaque sous-tâche (c'est ce que l'assistant relit).

---

## Curseur courant

- **Épic en cours :** **B — Sections manquantes** (branche `feat/missing-sections`)
- **Prochaine sous-tâche :** **B4 — Heuristiques** (pas commencée)
- **Dernière mise à jour :** 2026-06-12

## État détaillé de l'Épic B

| Sous-tâche | État | Notes |
|-----------|------|-------|
| B1 — Pages légales (`/conditions`, `/confidentialite`, `/accessibilite`) | ✅ committé | `47d306f` |
| B2 — Réinitialisation mot de passe bout-en-bout | ✅ committé | `52a9064`, `c54782d` |
| B3 — Admin réservations / locations / utilisateurs | ✅ committé | `3e4c174` `f43fbe4` `bcaa95e` `d268b82` |
| **#11 — Correctifs de revue B1/B2** | ✅ **committé** (voir prochain commit) | minuscule mot de passe (client≡serveur, L-004), IT câblé dans CI (L-005), gardes de ré-entrée + focus sur erreur, focus-ring sombre, warning prod EmailService, commentaire canal temporel (L-007) |
| **B4 — Heuristiques** | ❌ **À FAIRE — prochaine tâche** | voir ci-dessous |

## B4 — détail de ce qui reste (prochaine tâche)

1. **H5 — Vérification de disponibilité** : `GET api/v1/auth/availability?username=&email=`
   (nouveau `APP/Auth/CheckAvailability/*` via `IIdentityService`) + validateurs asynchrones
   *debounced* sur le formulaire d'inscription (`features/auth/auth.ts`).
2. **H1 — Confirmation du changement de langue** : `aria-live` après rechargement via marqueur
   `sessionStorage` (i18n = builds par locale).
3. **FAQ** : accordéon a11y existant sur `/installation` + `/location` (`shared/content/faq.data.ts`).
4. **Règle métier à intégrer (nouvelle, cf. handoff §4)** : le catalogue reste 100 % Tempo, mais le
   **service d'installation accepte d'autres marques** → ajouter champs **marque/modèle** à
   `BookingSlot` + `CreateBookingCommand` (mini-migration + DTO + validateur), avec **exclusion
   ShelterLogic** côté client *et* serveur (L-004), et une ligne FAQ « on installe d'autres marques
   sauf ShelterLogic ». *(Peut aussi être traité comme un mini-épic juste après B — à confirmer avec
   l'utilisateur.)*

Docs à retourner en fin d'Épic B : README roadmap, `docs/agile/board.md`, `product-backlog.md`
(H1/H5 → done), avant/après dans les audits.

## Clôture de l'Épic B (quand B4 est fini)

Suivre le workflow standard de fin de tâches liées (cf. `/next-task`) :
1. Gates : `dotnet test`, `npm test`, `npm run e2e` (zéro violation axe).
2. **`code-reviewer` indépendant** sur tout le diff `feat/missing-sections` (l'implémenteur ne valide
   jamais son propre diff).
3. **`mentor`** : capturer la leçon `scrollable-region-focusable` trouvée en B3.
4. Retourner les statuts (board, backlog, README roadmap).
5. **commit → PR → revue CI → merge/push vers `master`.**
6. Mettre à jour ce pointeur : curseur → **Épic C**.

## Suite du programme (après B)

- **Épic C** — Adresse structurée + autocomplétion (`feat/address-split-autocomplete`)
- **Épic D** — Outil `/mesurer` parking + suggestions (`feat/mesurer-parking`) — *après C*
- **Épic E** — Redesign v2 (`feat/redesign-v2`) — *après D*
- **Épic F** — Wrap-up docs/process (`docs/program-wrapup`)

Détail complet de chaque épic : voir le fichier de plan référencé en tête.
