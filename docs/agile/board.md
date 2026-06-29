# Tableau Scrum / Kanban — AbrisTempo Local (instantané courant)

> **Source de vérité.** L'état narratif vivant du programme (épopées, PR, SHA, décisions, leçons) est
> dans **`PROGRAM-STATUS.md`** — c'est le **pointeur de reprise unique**. Ce fichier-ci ne garde que
> deux choses : l'**instantané courant** du tableau et le **registre des bogues & dette technique**.
> L'historique chronologique des clôtures a été déplacé dans **`CHANGELOG.md`** (archive).
>
> Terminologie Azure DevOps (Story / Task / Bug). Identifiants alignés sur `product-backlog.md`.
> Gravité selon le gabarit `.github/ISSUE_TEMPLATE/bug_report.md` : **Bloquant / Majeur / Mineur /
> Cosmétique**.

## État courant (2026-06-29)

**Phase 2 TERMINÉE — les 10 épopées (7→16) sont livrées et mergées** (ordre `12→15→9→10→13→14→11→8→7`
entièrement parcouru ; Programme A→H également clos). **Aucun sprint actif, aucune épopée en file** :
le programme attend une nouvelle demande du propriétaire. Détail par épopée → `PROGRAM-STATUS.md` +
`CHANGELOG.md` ; backlog résiduel → `product-backlog.md`.

| Backlog (non engagé) | À faire | En cours | Revue | Terminé |
|----------------------|---------|----------|-------|---------|
| Dette/suivis ouverts (voir registre ↓) | — | — | — | Programme A→H + Phase 2 (épopées 7→16) |
| Portées gelées : US-7.2 cartes/Interac Debit (payant), accessoires modal config, B2 effondrement DTO | | | | |

> **Portées gelées / différées** (décisions propriétaire — *pas* des bogues) : **US-7.2** cartes &
> Interac Debit (réseau payant, exige accord budget — `budget-free-tier.md`) ; **accessoires** dans le
> modal de configuration d'abri (reporté) ; **B2** effondrement de DTO. Réactivables sur demande.

---

## Registre des bogues & dette technique

> Source unique et conforme pour le suivi des bogues/dette (le dépôt est solo : les *issues* GitHub via
> `.github/ISSUE_TEMPLATE/` restent optionnelles, mais ce registre en suit les champs — Gravité +
> critère WCAG). Lignes `✅ Résolu` conservées comme référence ; lignes `🟠 Ouvert` = backlog actif.

### Bogues — résolus

| ID | Titre | Type | Gravité | Critère WCAG / Heuristique | Statut | Réf (PR / commit / leçon) |
|----|-------|------|---------|----------------------------|--------|---------------------------|
| Bug-01 | Contraste footer / why-us < 4.5:1 | Bug a11y | Majeur | 1.4.3 | ✅ Résolu | `_tokens.scss` (Sprint 3) |
| Bug-02 | Skip-link disparaît à l'hydratation SSR | Bug a11y | Mineur | 2.4.1 | ✅ Résolu | `styles.scss` (Sprint 3) |
| Bug-03 | Champs natifs illisibles en mode sombre OS | Bug a11y | Majeur | 1.4.3 / 1.4.11 | ✅ Résolu | `color-scheme` (`_tokens.scss`) |
| Bug-04 | Focus indésirable sur `main` après skip | Bug a11y | Mineur | 2.4.7 | ✅ Résolu | `app.scss` |
| Bug-05 | Dropdown navbar sous le contenu | Bug a11y | Mineur | 1.4.11 | ✅ Résolu | échelle `z-index` tokenisée |
| Bug-06 | Login refusait les noms d'utilisateur | Bug | Majeur | 3.3.8 | ✅ Résolu | `auth.ts` |
| Bug-07 | Menus navbar non fermables au clavier | Bug a11y | Majeur | 2.1.2 / H3 | ✅ Résolu | `navbar.ts` (pattern disclosure) |
| Bug-08 | Menu fermé garde des enfants focusables (`aria-hidden` au lieu d'`inert`) | Bug a11y | Majeur | 4.1.2 | ✅ Résolu | `[inert]`, `navbar.spec.ts`, L-010 |
| Bug-09 | Badge « Ajusté serré » illisible thème sombre (`#fff` sur amber 1.67:1) | Bug a11y | Majeur | 1.4.3 | ✅ Résolu | EPIC 12 p2 — `--color-warning-solid`/`--color-on-warning` ≈5.05:1, L-033 |
| US-14.2 | `/mesurer` : `turf.bbox` sur-estime un stationnement pivoté → abri trop grand | Bug fonctionnel | Mineur | — (L-034) | ✅ Résolu | EPIC 14 — `measure-rect.util` (haversine par arête) |

> **Réconciliation (2026-06-29).** Bug-09 figurait à la fois `🟠 Ouvert` (entrée D4/D5) et `✅ livré`
> (EPIC 12 partie 2) dans l'ancien journal append-only : il est **résolu**. Statut unifié ci-dessus ;
> l'historique reste dans `CHANGELOG.md`.

### Dette technique & suivis — ouverts

| ID | Titre | Type | Gravité | Réf | Statut |
|----|-------|------|---------|-----|--------|
| Sec-01 | Pas de *rate-limiting* sur `forgot-password` et `availability` (énumération de comptes + DoS sur endpoint coûteux) | Dette sécurité | Majeur | `AuthController` (~L72-73, ~L102-104) — réutiliser l'idiome limiteur `places` (Épic C, `C2`) | 🟠 Ouvert (backlog) |
| Tech-01 | `UpdateBookingStatusCommand` / `UpdateOrderStatusCommand` : `switch` sur chaîne d'action | Refactor / dette | Mineur | `design-patterns.md` §3 — enum + Strategy **si** les actions croissent (acceptable en l'état) | 🟠 Ouvert (optionnel) |
| Data-01 | « Produits qui ne devraient plus exister » : **4 `ShelterModels` actifs de test** en base **dev** (`ascii-1781882695`, `diag-1781882619`, `live-test-abri-1781882483`, `rt2-1781882666`) — artefacts de tests CRUD admin manuels, **non semés**, visibles au catalogue | Donnée (base dev) | Mineur | Code seeder **correct** (les 8 abris-produits legacy + `double-pointu`/`double-rond`/`simple` sont déjà `IsDeleted=1`) ; famille L-031 — cruft dev, **pas** un bogue de code | 🟠 Ouvert — nettoyage base dev en attente d'accord (soft-delete réversible) ; vérifier aussi la base **prod** (Azure SQL, probablement saine — créés en local) |
| Flake-01 | `a11y.spec.ts` Boutique : `aria-prohibited-attr` intermittent (`<div aria-busy aria-label>` sans `role` au chargement) | Flake test | Mineur | `catalog.html`, L-019 | 🟠 Ouvert |
| Flake-02 | `mesurer.spec.ts` smoke carte conteneur-only *flaky* (timing `@defer` Leaflet) | Flake test | Mineur | L-019 / L-012 — remplacer l'assertion conteneur par la **capacité** ou une barrière réseau | 🟠 Ouvert |
| Perf-01 | Bundle initial ~504 kB > budget *warn* 500 kB (sous le seuil *error* 1 MB → CI ne casse pas) | Dette perf | Cosmétique | budgets `angular.json` — rogner l'initial **ou** relever le seuil justifié | 🟠 Ouvert |
| CI-01 | Actions GitHub sur Node 20 dépréciées (forçage Node 24) | Dette CI | Mineur | `.github/workflows/*` — bumper `checkout`/`setup-node`/`setup-dotnet` | 🟠 Ouvert |

### Nettoyage — résolu (passe consolidation 2026-06-29)

| ID | Titre | Type | Gravité | Statut |
|----|-------|------|---------|--------|
| Cleanup-01 | Retrait du *scaffolding* template `WeatherForecastController.cs` + `WeatherForecast.cs` (non référencés) | Nettoyage | Cosmétique | ✅ Résolu |
| Cleanup-02 | Retrait de ~97 lignes de code mort commenté (ancien `AuthService`) dans `auth.service.ts` | Nettoyage | Cosmétique | ✅ Résolu |
| Docs-01 | Consolidation du dossier `.ai/` (obsolète) → `docs/engineering/` ; `CLAUDE.md` recadré | Nettoyage docs | Cosmétique | ✅ Résolu |
| Docs-02 | Standardisation `board.md` (instantané + registre) + journal archivé dans `CHANGELOG.md` | Nettoyage docs | Cosmétique | ✅ Résolu |

---

## Indicateurs (référence historique)

- **Cartes Terminées** : Programme A→H + Phase 2 (épopées 7→16) — toutes mergées, CI verte.
- **Ratio Bug / Story** : faible, concentré sur l'a11y détectée et corrigée **en flux continu**
  (boucle *audit → correctif → vérification → re-documentation*).
- **Détail chronologique** : `CHANGELOG.md` (clôtures de sprints/épopées, gates, leçons L-001→L-055).
