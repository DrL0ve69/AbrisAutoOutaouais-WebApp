---
name: feature-cycle
description: >-
  Runs the full architect → developer → reviewer → mentor delivery loop for a feature or bug
  fix on AbrisTempo Local. Use when the user asks to build/implement/fix something non-trivial,
  or types /feature-cycle. Orchestrates the project's subagents and closes the learn loop.
argument-hint: [what to build or fix]
---

# Feature delivery cycle

Drive a change through the team's four agents **from the main conversation** (subagents can't call
each other, so you — the main thread — are the coordinator). Scale the ceremony to the task: skip
straight to step 3 for a one-line change; run the whole loop for anything touching multiple files,
a contract, an endpoint, an entity, or a migration.

**Task:** $ARGUMENTS

## The loop

1. **Plan — `solution-architect`.** Delegate the request to the `solution-architect` subagent. It
   returns a file-level plan (affected files, contracts, migration needs, risks, verification plan).
   Read it; if it surfaces a real decision that's the user's to make, ask the user before coding.

2. **Implement — `feature-developer`** (or do it yourself in the main thread for small changes).
   Follow the plan. Backend stays inside Clean Architecture + custom Mediator; frontend follows the
   `angular` skill + angular-cli MCP. Reproduce bugs with a failing test first, then fix the root
   cause. The `PostToolUse` guardrail will remind you which verification each edit needs.

3. **Verify.** Run the real checks and keep the output as evidence:
   - Backend: `dotnet test`.
   - Frontend (from `src/AbrisAutoOutaouais-WebApp.Client`): `npm run build` + `npm test`; add an
     `e2e/a11y.spec.ts` scenario for any newly-audited route.
   - For data/owned-entity changes, verify against **real SQL Server LocalDB**, not just InMemory
     tests (lesson L-001).

4. **Review — `code-reviewer`.** Delegate a fresh-context review of the diff to the `code-reviewer`
   subagent (it's read-only and didn't see your reasoning — that's the point). Address every
   **Critical/Major** finding (loop back to step 2). Treat nits as optional. Don't let the developer
   sign off on its own work.

5. **Capture — `mentor`.** If the review (or the fix) surfaced a recurring or non-obvious gotcha,
   delegate to the `mentor` subagent to record it in `.claude/rules/lessons-learned.md`. That file
   is auto-injected next session, so the lesson reaches everyone automatically.

6. **Wrap up.** Summarize what changed, the evidence (commands + results), and any lesson captured.
   Feature branch only, never `master`; Conventional Commit; only commit/push when the user asks.
   **Delegate the git plumbing — staging, the Conventional-Commit message (FR), the branch, the `gh`
   PR, CI watching, and the status-doc sync — to the `git-ops` subagent (Sonnet)** instead of spending
   main-thread (Opus) tokens on it. Hand it the diff summary + green-gate evidence; keep the decision
   of *what* to commit/merge on the main thread (it never merges/force-pushes without an explicit ask).

## Notes
- Newly-created/edited agent files load on the **next** Claude Code session (restart), not mid-session.
  If a subagent isn't available yet, run the same step inline using the matching skill
  (`solid-review`, `angular`, `a11y-ux-pass`) and the `/code-review` command, then restart to get
  the dedicated agents.
- See `.claude/README.md` for how the whole system fits together.
