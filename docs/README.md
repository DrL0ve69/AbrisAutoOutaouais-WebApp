# Documentation produit, accessibilité & UX — AbrisTempo Local

Ce dossier `docs/` rassemble les livrables de **portfolio** démontrant des compétences en
**accessibilité (WCAG 2.2)**, **évaluation UX**, et **gestion Agile** d'un produit numérique.
Tous les documents sont **fondés sur le code réel** de l'application `AbrisAutoOutaouais-WebApp`
(front-end Angular 21, SSR, i18n fr/en) — chaque affirmation cite le composant, le fichier ou
le critère correspondant.

> Application : AbrisTempo Local — vente, location et installation d'abris d'auto Tempo en
> Outaouais. Stack : .NET 10 / Angular 21, Clean Architecture, tests axe-core + Playwright.

---

## Index des documents

| Document | Contenu | Compétence d'emploi visée |
|----------|---------|----------------------------|
| [`accessibility/wcag-2.2-audit.md`](accessibility/wcag-2.2-audit.md) | Audit de conformité **WCAG 2.2 AA** : méthodologie (axe-core unitaire + e2e Playwright, Lighthouse, NVDA/VoiceOver, clavier, zoom 200/400 %), portée, tableau de conformance par principe, section dédiée aux **nouveaux critères 2.2** (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8), anomalies corrigées avant/après, risques résiduels. | (1) Tests WCAG 2.2 + identification des non-conformités et **recommandations de remédiation** ; (5) outils d'assistance (JAWS/NVDA/VoiceOver, Axe, Lighthouse) ; (6) design system / guidelines a11y |
| [`ux/heuristic-evaluation.md`](ux/heuristic-evaluation.md) | **Évaluation heuristique** (10 heuristiques de Nielsen) : constats par heuristique, **cote de sévérité 0–4**, recommandations concrètes, tableau récapitulatif trié. | (2) **Évaluation UX — revues heuristiques** traduites en recommandations (compétence prioritaire) |
| [`ux/task-flow-analysis.md`](ux/task-flow-analysis.md) | **Analyses de flux de tâches** (4 parcours : achat, auth, profil, réservation) : diagrammes d'étapes, points de friction, recommandations, + section **évaluation de la convivialité** (efficacité / efficience / satisfaction). | (2) **Évaluation UX — analyses de flux & usabilité** (compétence prioritaire) |
| [`agile/product-backlog.md`](agile/product-backlog.md) | **Backlog** : épopées + user stories (« En tant que… »), critères d'acceptation, estimation **Fibonacci**, priorisation **MoSCoW** (catalogue, auth/profil, a11y, i18n, thème, panier). | (3) Intégration a11y/UX dans des cycles Agile ; (4) gestion d'artefacts |
| [`agile/sprint-plan.md`](agile/sprint-plan.md) | **3 sprints** mappant le travail livré (catalogue/seed, auth/profil/sécurité, a11y/UX/i18n/thème) : objectifs, vélocité, **rétrospectives**, terminologie **Azure DevOps** (Epic/Feature/Story/Task/Bug). | (3) Agile ; (7) recommandations d'**amélioration de processus** |
| [`agile/definition-of-ready.md`](agile/definition-of-ready.md) | **DoR** : critères d'entrée en sprint, incluant exigences a11y/i18n/test explicitées en amont. | (3) Agile ; (4) qualité des artefacts |
| [`agile/definition-of-done.md`](agile/definition-of-done.md) | **DoD** : tests verts, **axe 0 violation**, build OK, i18n balisé, revue de code, vérifs clavier/lecteur d'écran. | (3) Agile ; (4) gestion défauts/tests |
| [`agile/board.md`](agile/board.md) | **Snapshot de tableau** Scrum/Kanban (Backlog / À faire / En cours / Revue / Terminé) avec items et **bugs a11y réels** corrigés. | (4) gestion des défauts et artefacts de test (style Azure DevOps) |

---

## Correspondance avec les compétences (offres HoC & Ville de Gatineau)

1. **Tests d'accessibilité WCAG 2.2** + non-conformités + remédiation → `wcag-2.2-audit.md`.
2. **Évaluation UX (heuristiques, flux de tâches, usabilité)** → `heuristic-evaluation.md` + `task-flow-analysis.md` *(compétence la plus importante).*
3. **Intégration a11y/UX en Agile** → `sprint-plan.md`, `product-backlog.md`, `definition-of-*.md`.
4. **Gestion des défauts / artefacts (Azure DevOps)** → `board.md`, `definition-of-done.md`.
5. **Technologies d'assistance & outils** (NVDA, VoiceOver, JAWS, Axe, Lighthouse) → méthodologie de `wcag-2.2-audit.md`.
6. **Design system / guidelines** → design tokens (`shared/styles/_tokens.scss`), composants a11y (`shared/components/a11y-components/`), documentés dans l'audit.
7. **Amélioration de processus** → actions de rétrospective (`sprint-plan.md`) + risques/recommandations (`wcag-2.2-audit.md`, évaluations UX).

---

## Preuves dans le code (raccourcis)

- Tests axe unitaires : `src/AbrisAutoOutaouais-WebApp.Client/src/testing/axe-helper.ts`, `.../features/home/home.a11y.spec.ts`
- Tests axe e2e (Playwright + `@axe-core/playwright`) : `.../e2e/a11y.spec.ts`, `.../playwright.config.ts`
- Design tokens & contrastes documentés : `.../src/app/shared/styles/_tokens.scss`
- Utilitaires a11y (sr-only, focus trap) : `.../src/app/shared/styles/_a11y.scss`
- Focus visible / skip-link / cibles : `.../src/styles.scss`
- i18n fr/en : `.../angular.json` (bloc `i18n`), `.../src/locale/messages.en.xlf`
- Authentification accessible (courriel ou username) : `.../src/app/features/auth/auth.ts` + `auth.html`
