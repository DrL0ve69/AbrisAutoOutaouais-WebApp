# Program status — pointeur de reprise

> **But.** Fichier de reprise unique pour le programme « Compléter + Adresse + Mesurer + Redesign 10k ».
> Quand une session redémarre (gestion du contexte), dis simplement **« continue la prochaine tâche »**
> ou lance **`/next-task`** : l'assistant lit ce fichier + le plan, vérifie l'état git, puis enchaîne.
>
> **Plan complet (6 épics A→F) :** `C:\Users\phili\.claude\plans\1-i-want-you-glistening-barto.md`
> Maintiens ce pointeur à jour à la fin de chaque sous-tâche (c'est ce que l'assistant relit).

---

## Curseur courant

- **Épic en cours :** **Épic C — Adresse structurée + autocomplétion accessible** (branche `feat/address-split-autocomplete`)
- **Prochaine sous-tâche :** **Fold-in marque/modèle + exclusion ShelterLogic** (dernière tâche d'implémentation de l'Épic C, voir section dédiée plus bas) — **puis frontière d'épic : revue indépendante complète → commit/PR/CI → merge `master`**.
- **Décision (2026-06-12) :** le mini-cycle « marque/modèle + exclusion ShelterLogic » est **fusionné dans l'Épic C** (pas de cycle séparé) — à intégrer au flux réservation pendant C.
- **Dernière mise à jour :** 2026-06-13

### Épic C — progression

| Sous-tâche | État | Commits locaux (branche `feat/address-split-autocomplete`) |
|-----------|------|------------------------------------------------------------|
| C1 — Split Address VO + migration + validateur canonique | ✅ (gates vertes, **non revu**) | `5e97441` (VO+DTO+configs+migration), `983ed1f` (validateur canonique + 2 validateurs création), `d37556a` (front : 4 formulaires + validators partagés) |
| C2 — Proxy Places | ✅ (gates vertes : build + 200/200 tests, **non revu**) | `53175c3` (IPlacesService + DTO canonique + 2 queries CQRS, Photon/Radar/Google, 1er `AddHttpClient` typé, rate limiter 30/10s, `PlacesController` `[AllowAnonymous]`, README) |
| C3 — Autocomplete accessible (APG combobox) + lien aux 4 formulaires | ✅ (gates vertes, **non revu**) | `8183d46` (combobox APG `shared/.../autocomplete`, `places.service.ts` + `place.model.ts`, 4 formulaires câblés rue→autocomplete + lookup code postal éditable + aria-live, e2e clavier-seul + axe, i18n fr/en) |
| Fold-in marque/modèle + exclusion ShelterLogic (client+serveur, L-004) | ⬜ à faire | — |

**À traiter à la frontière d'épic (avant PR/merge) :**
- **Revue indépendante `code-reviewer`** du diff complet C (l'implémenteur n'a PAS revu son propre diff ; seul un `solid-review` auto est passé — propre).
- **Déviation au plan à valider :** C1 n'applique **pas** la liste blanche de provinces que le plan prescrivait — l'appliquer ré-introduirait la régression **L-004** (Ontario → 400) verrouillée par `PlaceOrderCommandValidatorTests`. `Province` validé en `NotEmpty + MaxLength(2)`. Décision correcte (la leçon gagne sur le plan), à confirmer en revue.
- **Candidats leçon à soumettre au `mentor` à la clôture d'épic (3 en attente) :**
  - (C1) « un plan d'architecte validé ne périme pas `lessons-learned` — grep les `*ValidatorTests`/commentaires citant une leçon avant d'implémenter une règle de validation "partagée". »
  - (C2) « toute nouvelle classe de test d'intégration sur la `WebAppFactory` mutualisée doit rester dans `[Collection("Integration")]` — base InMemory nommée + `IdentitySeeder` partagés ; une classe hors collection s'exécute en parallèle → course au seeder (`IsInRoleAsync` "single result") → fait échouer ~63 tests sans rapport au démarrage de l'hôte (même classe que L-010 : état global partagé). `IClassFixture` isole déjà le rate limiter par classe ; la collection ne sert qu'à sérialiser le seeder. »
  - (C3) « nommer un `input()` d'après un attribut DOM global (`id`, `class`, `role`…) sur un composant le **reflète sur l'élément hôte EN PLUS** de son usage interne → id dupliqué (hôte + input interne) et calcul du nom accessible cassé : `getByRole(..., { name })` échoue car `getElementById`/`<label for>` résout le 1er `#id` (l'hôte, non étiquetable). Règle : neutraliser l'attribut sur l'hôte (`host: { '[attr.id]': 'null' }`) pour qu'un seul élément le porte. Corollaire (proche L-010) : en vitest browser le `document` est partagé entre rendus → scoper par `within(container)`, jamais d'id en double. »
- Migration `SplitAddressCivicNumber` (`20260613033910`) déjà appliquée sur LocalDB réelle ; eyeball du script fait (add-nullable → backfill T-SQL → NOT NULL seulement Rental/Booking).

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
`docs/ux/heuristic-evaluation.md` (H1–H10 tous remédiés). **PR #15 mergée vers `master` ✅ (`7ccec41`).**

## Suite du programme (après le mini-cycle)

- **Épic C** — Adresse structurée (civic/apt/rue) + autocomplétion accessible (proxy Photon/Radar/Google) — `feat/address-split-autocomplete`
- **Épic D** — Outil `/mesurer` parking + suggestions (Leaflet + turf) — `feat/mesurer-parking` — *après C*
- **Épic E** — Redesign v2 (tokens v2, GSAP hero, three.js viewer) — `feat/redesign-v2` — *après D*
- **Épic F** — Wrap-up docs/process — `docs/program-wrapup`

Détail complet de chaque épic : voir le fichier de plan référencé en tête.
Règle git de fin d'épic : revue → commit → PR → revue CI → merge/push `master`.
