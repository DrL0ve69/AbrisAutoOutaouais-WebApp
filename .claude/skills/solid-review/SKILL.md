---
name: solid-review
description: Review changed or specified code against the SOLID principles (SRP, OCP, LSP, ISP, DIP) and report concrete violations with refactor suggestions. Use when asked to review code quality, check SOLID compliance, audit a class/component, or before merging a feature.
---

# SOLID review

Review the target code against the five SOLID principles and report concrete, actionable findings. SOLID is about **responsibilities and dependencies**, not single lines — read each type/class/component in full before judging.

## 1. Choose the target
- If the user named files, review those.
- Otherwise review the current change set: `git diff --stat` then `git diff` against the base branch.
- Backend focus: `…Application/` (CQRS handlers, validators), `…Domain/` (entities, value objects), `…Infrastructure/` (services, EF), `…API/` (controllers). Frontend focus: services, components, guards, interceptors.

## 2. The five principles — what to flag
- **SRP — Single Responsibility.** One reason to change. Flags: a class/handler/component that orchestrates *and* persists *and* formats; "god" services; Angular components that fetch + transform + present instead of delegating to a service. In this repo: a CQRS handler holds exactly one use case; controllers stay thin (dispatch only); validators live beside their command.
- **OCP — Open/Closed.** Open to extension, closed to modification. Flags: a growing `switch`/`if-else` on a type/enum that must be edited for every new case → prefer polymorphism, strategy, or a registry (e.g. the Scrutor handler scan, pipeline behaviors).
- **LSP — Liskov Substitution.** Subtypes honor the base contract. Flags: overrides throwing `NotImplementedException`, narrowed preconditions/widened postconditions, `is`/cast chains that defeat the abstraction.
- **ISP — Interface Segregation.** No fat interfaces. Flags: an interface whose implementers no-op or throw on some members; clients forced to depend on methods they don't use. Prefer focused contracts (`ICurrentUserService`, `IDateTimeProvider`, `IFileStorageService`) over one catch-all service.
- **DIP — Dependency Inversion.** Depend on abstractions; high-level policy must not depend on low-level detail. Flags: Application referencing Infrastructure types, `new`-ing a dependency instead of injecting it, Angular components `new`-ing a service instead of `inject()`. Clean Architecture rule: dependencies point inward (Domain ← Application ← Infrastructure/API).

## 3. Output
A findings table: `Principle | Severity (high/med/low) | file:line | Problem | Concrete refactor`. Lead with the highest-severity, most certain findings. State when a file is clean. Don't invent violations; when a trade-off is acceptable (a pragmatic DTO, a thin mapper), say why. Close with 1–3 prioritized next actions.

Respect repo conventions (see `CLAUDE.md`): C# 14 primary constructors + `sealed record` DTOs + custom Mediator; Angular standalone components + signals + `inject()`.
