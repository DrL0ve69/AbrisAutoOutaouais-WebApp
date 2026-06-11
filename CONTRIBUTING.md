# Contribuer — flux de travail Agile

Ce projet suit un flux **Agile/Scrum léger** avec intégration continue. Les artefacts de
planification vivent dans [`docs/agile/`](docs/agile) (backlog, plan de sprints, DoR/DoD, tableau).

## Cycle de développement

1. **Backlog → Sprint.** Les *user stories* (gabarit dans `.github/ISSUE_TEMPLATE`) sont
   raffinées (Definition of Ready) puis sélectionnées dans un sprint.
2. **Branche par story.** Jamais de commit direct sur `master`.
   - `feat/…`, `fix/…`, `a11y/…`, `refactor/…`, `docs/…`
3. **Commits conventionnels** : `feat(catalogue): filtre par catégorie`, `a11y(navbar): focus visible`.
4. **Pull Request** vers `master` avec le gabarit fourni → revue de code (incluant une passe
   [SOLID](.claude/skills/solid-review) et accessibilité) → merge quand la **Definition of Done** est verte.
5. **CI** (`.github/workflows/ci.yml`) valide chaque PR : build + tests + **0 violation axe** (régression d'accessibilité).

## Definition of Ready / Done

Voir [`docs/agile/definition-of-ready.md`](docs/agile/definition-of-ready.md) et
[`docs/agile/definition-of-done.md`](docs/agile/definition-of-done.md). En résumé, une story
n'est *terminée* que si : code conforme (SOLID, `CLAUDE.md`), tests verts, **0 violation axe**
(unitaire + e2e), navigation clavier OK, chaînes i18n balisées, aucune fuite de secret.

## Qualité du code

- Backend : `dotnet build` + `dotnet test` après chaque changement.
- Frontend : `npm run build`, `npm test` (Vitest navigateur + axe), `npm run e2e` (Playwright + axe).
- Conventions : voir [`CLAUDE.md`](CLAUDE.md). Principes **SOLID** vérifiés en revue.

## Accessibilité (non négociable)

Chaque contribution doit préserver la conformité **WCAG 2.2 AA**. Outils : axe-core (intégré aux
tests), Lighthouse, navigation clavier, lecteurs d'écran (NVDA / VoiceOver). Voir
[`docs/accessibility/`](docs/accessibility).
