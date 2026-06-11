# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Codebase language is **French** (comments, XML docs, commit messages, business terms). Match it.

## Project

**AbrisTempo Local** (`AbrisAutoOutaouais-WebApp`) — e-commerce + booking web app for a regional rep of the [Abris Tempo](https://www.abristempo.com/en) brand. Three business domains: **product sales** (with delivery), **shelter rentals**, and **installation booking**. .NET 10 / C# 14 backend, Angular 21 frontend.

> The `.ai/` folder (`CLAUDE.md`, `QUICKSTART.md`, `LAYER_*.md`, etc.) documents the *intended design*. It has **drifted from the actual code** — trust the source, not those docs. The biggest divergences are called out below (single DbContext, project paths, handler registration). When `.ai/` and reality conflict, the code wins.

## Build & Run

The solution file is `AbrisAutoOutaouais-WebApp.slnx` (new XML solution format). Run all `dotnet` commands from the repo root.

```powershell
# Backend
dotnet build
dotnet run --project src/AbrisAutoOutaouais-WebApp.API
# API: https://localhost:5001 (Scalar/OpenAPI UI at /scalar in Development)

# Tests (xUnit v3 + FluentAssertions + NSubstitute)
dotnet test
dotnet test AbrisAutoOutaouais-WebApp.UnitTest          # unit only
dotnet test AbrisAutoOutaouais-WebApp.IntegrationTest   # integration only
dotnet test --filter "FullyQualifiedName~CreateProductCommandHandlerTests"   # single class
dotnet test --filter "DisplayName~returns_404"                               # single test

# Frontend (from src/AbrisAutoOutaouais-WebApp.Client)
npm install
npm start              # ng serve --host=127.0.0.1 → http://localhost:4200
npm test               # vitest run
npm run build:prod     # production build (SSR)
npm run i18n:extract   # extract i18n strings → src/locale (xlf)
```

### EF Core migrations — single context

There is **one** `ApplicationDbContext` that holds **both** ASP.NET Core Identity *and* the domain entities (NOT two contexts — ignore the `AppIdentityDbContext` / two-connection-string instructions in `.ai/`). Connection string key is `DefaultConnection` (SQL Server LocalDB, database `AbrisTempoDb`). Migrations live in `Infrastructure/Persistence/Migrations`.

```powershell
dotnet ef migrations add <Name> `
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure `
  --startup-project src/AbrisAutoOutaouais-WebApp.API `
  --output-dir Persistence/Migrations

dotnet ef database update `
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure `
  --startup-project src/AbrisAutoOutaouais-WebApp.API
```

`Jwt:Key` and the connection string are in `appsettings.json` for dev; move to user-secrets / Key Vault for real deployments.

## Architecture

Clean Architecture, dependencies point inward only: **Domain ← Application ← Infrastructure / API**.

| Project | Role |
|---------|------|
| `src/...Domain` | Entities, enums, domain events (`IDomainEvent`), exceptions, interfaces (`IAuditableEntity`, `ISoftDeletable`). Zero external deps. |
| `src/...Application` | CQRS handlers, DTOs, FluentValidation validators, custom Mediator, pipeline behaviors. Depends only on Domain. |
| `src/...Infrastructure` | EF Core (`ApplicationDbContext`), Identity, JWT, interceptors, external services. Implements Application interfaces. |
| `src/...API` | Controllers (thin), middleware, `Program.cs` composition root. |
| `src/...Client` | Angular 21 frontend. |

### Custom Mediator (NOT MediatR)

Hand-rolled dispatcher in `Application/Common/Mediator/`. Interfaces: `ICommand<T>`, `IQuery<T>`, `ICommandHandler<,>`, `IQueryHandler<,>`, `IDispatcher`. Handlers are **auto-registered via Scrutor** assembly scanning in `Infrastructure/DependencyInjection.cs` — no manual registration.

> The `Dispatcher` exposes both `Send`/`Query` (return `ValueTask`) and `DispatchAsync` (returns `Task`). Controllers currently call **`dispatcher.DispatchAsync(...)`**; handlers implement `HandleAsync`. Follow the pattern of the surrounding controller/handler when adding new ones.

### Data access

- `IApplicationDbContext` is injected directly into handlers — no generic repository.
- Entity config via `IEntityTypeConfiguration<T>` in `Infrastructure/Persistence/Configurations/` (not data annotations).
- Read queries use `.AsNoTracking()`.
- **`SoftDeleteInterceptor`** + `ISoftDeletable` + global `HasQueryFilter` → soft delete (`.IgnoreQueryFilters()` to bypass). **`AuditInterceptor`** populates `IAuditableEntity` audit fields.

### API conventions

- Versioned routes: `[Route("api/v{version:apiVersion}/[controller]")]` → e.g. `/api/v1/products`.
- Endpoints are public only with explicit `[AllowAnonymous]`; otherwise auth required.
- Roles in `Domain/Constants/Roles.cs`: `Customer`, `Staff`, `Admin`. Authorization policies `StaffOrAbove` and `AdminOnly` registered in DI.
- No `try/catch` in controllers, no manual `ModelState` checks. `ValidationBehavior` throws `ValidationException` before handlers; domain throws `NotFoundException` etc. `GlobalExceptionHandler` (`IExceptionHandler`) maps everything to RFC 9457 ProblemDetails.
- An `IdentitySeeder` runs on startup (roles + default admin account).

## Code style

**C# 14 / .NET 10:** file-scoped namespaces; primary constructors for DI; `sealed record` for DTOs/commands/queries; `is null` / `is not null`; `IReadOnlyList<T>`/`IEnumerable<T>` return types; role/constant strings in `Domain/Constants/`. Put a validator in the same folder as its command/query.

**Angular 21 / TypeScript:** standalone components (omit `standalone: true`); signals (`signal`/`computed`/`input()`/`output()`); `ChangeDetectionStrategy.OnPush`; `inject()` over constructor injection; native control flow (`@if`/`@for`/`@switch`); `[class]`/`[style]` bindings (no `ngClass`/`ngStyle`); `host` object (no `@HostBinding`/`@HostListener`); reactive forms; lazy-loaded feature routes. SSR is enabled; i18n strings live in `src/locale` (fr/en xlf). Accessibility is a hard requirement — the `shared/components/a11y-components/` set and `shared/styles/_a11y.scss` exist for this; keep zero AXE violations / WCAG AA.

## Workflow

Feature branches only (never commit to `master` directly). Run `dotnet test` after backend changes, `npm test` + lint before a PR. Conventional Commits. Don't touch `Domain/` lightly.
