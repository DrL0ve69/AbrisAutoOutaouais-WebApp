---
name: a11y-ux-pass
description: Turn the docs/ accessibility & UX audits into shipped code. Reads the WCAG 2.2 audit, heuristic evaluation and task-flow analysis, reconciles them against the real code, implements the still-pending findings (Angular conventions + WCAG AA), verifies with build/tests/axe, and updates the docs status tables. Use whenever asked to "apply the docs", act on an audit/heuristic finding, fix an a11y/UX issue, or do an accessibility pass on the AbrisTempo client.
---

# Accessibility & UX remediation pass

This repo ships its own audits in `docs/` (portfolio deliverables). Your job is to **close the loop**: audit → fix → verify → re-document. The audits **drift** from the code — always trust the source, then update the doc.

## 1. Gather the work-list
Read the three living audits and treat their recommendation/risk tables as the backlog:
- `docs/accessibility/wcag-2.2-audit.md` — § "Risques résiduels" (R1…Rn) and the per-criterion "À surveiller" rows.
- `docs/ux/heuristic-evaluation.md` — the recap table, ordered by severity (3 = major first).
- `docs/ux/task-flow-analysis.md` — the 🔴/🟡 friction points + recommendations.
- `docs/agile/board.md` + `docs/agile/product-backlog.md` — the "À faire" / "⛔" items mirror the same findings with IDs (Bug-07, US-1.5…).

**Reconcile before coding.** For each finding, open the cited component and confirm it's still pending — many are already done (e.g. `installation`/`location` are now real booking forms, cart/checkout exist, the reduced-motion flip is handled). Skip what's done; note the drift.

## 2. Implement, in this order
Major (severity 3 / "Haute") → cheap high-value a11y wins → cosmetic. For each:
- **Frontend (Angular 21):** follow the `angular` skill and, when connected, the `angular-cli` MCP (`get_best_practices`, `find_examples`) as source of truth. Non-negotiables: standalone components, explicit `ChangeDetectionStrategy.OnPush` (v21), signals + `computed()`, `inject()`, native control flow, `host` object (no `@HostListener`), `[class]`/`[style]` (no `ngClass`/`ngStyle`), reactive forms. French UI strings carry `i18n`/`@@id`. Reuse design tokens (`shared/styles/_tokens.scss`) and the `.field`/`.btn` patterns.
- **Accessibility bar:** zero AXE violations, WCAG 2.2 AA. Manage focus (return focus on dismiss, roving `tabindex` + arrows/Home/End for composite widgets per ARIA APG), name/role/value, ≥ 44px touch targets, visible focus, `aria-live` for async state, `prefers-reduced-motion`.
- **Backend (.NET 10):** when a finding needs API/handler work, make the change then run the **`solid-review`** skill on the diff before finishing. Respect Clean Architecture (Domain ← Application ← Infrastructure/API), custom Mediator, `sealed record` DTOs, validators beside their command.
- Don't introduce dead links: if a CTA points to a missing route, either build the (accessible) page or remove the link.

## 3. Verify (always, before claiming done)
From `src/AbrisAutoOutaouais-WebApp.Client`:
- `npm run build` — typechecks every template/component (dev config, no localized build needed).
- `npm test` — vitest unit + axe-core component tests must stay green.
- `npm run e2e` — Playwright + `@axe-core/playwright` (`color-contrast` active) when the change touches audited pages; add a scenario to `e2e/a11y.spec.ts` for any newly-audited route.
- Backend changes: `dotnet test` from the repo root.

## 4. Re-document (close the loop)
The `docs/` files are deliverables — keep them honest:
- Flip the status of the remediated item in `docs/agile/board.md` and `docs/agile/product-backlog.md` (⛔ → ✅).
- In the audit/heuristic/task-flow doc, move the finding from "à faire" to a "corrigé (avant/après)" entry, or update its severity, citing the file you changed.
- Record any newly-discovered drift so the next pass starts from truth.

## 5. Wrap up
Feature branch only (never `master`). Conventional Commit (e.g. `fix(a11y): …`, `feat(shop): …`). Summarize what was fixed, what was already done (drift), and what remains, mapped to the finding IDs.
