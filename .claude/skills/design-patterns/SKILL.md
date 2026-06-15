---
name: design-patterns
description: Verify or implement Gang-of-Four design patterns in AbrisTempo Local, favouring a hand-rolled pattern over an external dependency when the pattern is simple (the MediatR → custom Dispatcher precedent). Use when asked to apply/check a design pattern, audit a diff for pattern misuse or an unjustified dependency, refactor a growing if/else or god class, or wire a new service/use-case the idiomatic way.
---

# Design patterns — verify & implement

Two modes. Pick from the request; when ambiguous, do **Verify** first, then propose **Implement**.

Ground rule (the whole point of this skill): **hand-roll a simple pattern instead of adding a
dependency** — the repo's founding example is **MediatR replaced by a ~90-line `Dispatcher`**
(`Application/Common/Mediator/`). Never reinvent the hard, battle-tested stuff (ORM, crypto/JWT,
serialization, date parsing). Full reasoning + the 23-pattern map: `docs/design-patterns.md`. Short
operating rule: `.claude/rules/design-patterns.md`.

## A. VERIFY mode — audit code/diff for pattern fit & misuse

1. **Target.** Files the user named, else the change set: `git diff --stat` then `git diff` vs base.
2. **Load the bar.** `docs/design-patterns.md` (where each pattern already lives — reuse the idiom,
   don't invent a second mechanism) and `.claude/rules/design-patterns.md` (the decision + anti-patterns).
3. **Check, in priority order:**
   - **Unjustified dependency.** A new NuGet/npm package for a pattern that's simple to hand-roll, or
     where only a fraction would be used → flag (cite the MediatR precedent). *Keep* deps that are
     vast/durci (FluentValidation, Scrutor, EF, Identity) — flagging those is wrong.
   - **Reinvented wheel.** A 2nd mechanism duplicating an existing idiom (a parallel dispatch beside
     `Dispatcher`; a home-grown event bus beside `IDomainEvent`; a hand-coded singleton beside DI).
   - **Anti-patterns.** Growing `if/else`/`switch` on a type/enum (→ Strategy/polymorphism, OCP);
     business logic in a controller (→ handler/behavior); `new`-ing a dependency / Application→
     Infrastructure reference (DIP); classic static-instance Singleton (→ DI lifetime).
   - **Pattern present but incomplete.** New handler not auto-registered or controller wiring it by
     hand; new port adapter not emitting the canonical format (L-011); State enum transition missing
     its guard.
4. **Output.** A findings table: `Pattern | Severity (Critical/Major/Minor) | file:line | Problem |
   Concrete fix`. Lead with highest severity/confidence. Flag only real issues — not style or
   speculative over-engineering (a pragmatic enum+guard State is fine; don't demand a class per state).
   When a dependency is justified, **say so** rather than inventing a violation. End with a verdict and
   1–3 next actions.

## B. IMPLEMENT mode — apply a pattern the repo way

1. **Identify the pattern** from the need (use the table in `.claude/rules/design-patterns.md` §2).
2. **Find the existing idiom** and copy its shape — cohesion over novelty:
   - New use-case → **Command + Mediator**: `sealed record XxxCommand(...) : ICommand<XxxResult>` in
     `Application/<Feature>/Commands/Xxx/`; optional `XxxCommandValidator` in the **same folder**;
     `XxxCommandHandler : ICommandHandler<XxxCommand, XxxResult>` — copy a sibling handler's
     `HandleAsync` shape exactly (interface says `Handle`/`ValueTask`, handlers expose `HandleAsync`/
     `Task` bridged by `dynamic` — follow the neighbour). Scrutor auto-registers; the controller only
     calls `dispatcher.DispatchAsync(...)`. **Never** edit the dispatcher or add manual DI.
   - Cross-cutting concern → **Decorator/Chain** (pipeline behavior with `next()`, or EF/HTTP
     interceptor) — not controller code.
   - Third-party integration → **Adapter (+Strategy)**: a port `Ixxx` in Application + one adapter per
     provider in Infrastructure, selected by config in DI (mirror `IPlacesService`). Each adapter emits
     the canonical format the validator expects.
   - Interchangeable algorithm → **Strategy** (config `switch` in DI / policies), never a swelling
     `if/else`. React to a domain fact → **Observer** (`IDomainEvent` back; signals/RxJS front).
     Create-with-invariants → **Factory Method** (domain factory). Single instance → **DI singleton**.
3. **Respect conventions** (`CLAUDE.md`): C# 14 file-scoped namespaces, primary constructors,
   `sealed record` DTOs/commands, `is null`, validator beside its command, Clean Architecture
   boundaries (Domain ← Application ← Infrastructure/API). French comments/XML docs.
4. **Verify** (mandatory): backend → `dotnet test` + a `solid-review` pass on the diff (a misplaced
   pattern is first a SOLID violation); add the handler/unit test. Frontend → `npm run build` +
   `npm test`, follow the `angular` skill. Show the actual command output, not a claim.

Keep findings/changes tight and idiomatic. If a pattern decision is likely to recur, note it
"→ mentor: candidate lesson".
