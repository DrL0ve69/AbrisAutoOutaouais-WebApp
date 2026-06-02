# CLAUDE.md — AbrisTempo Local

Ce fichier sert de mémoire persistante pour Claude Code dans ce dépôt.
Il décrit le contexte métier, la stack technique, les conventions, et les règles d'architecture.

---

## Contexte métier

**AbrisTempo Local** est une application web e-commerce + réservation pour un représentant
régional de la marque [Abris Tempo](https://www.abristempo.com/en).

Le représentant offre trois services :
1. **Vente de produits** (abris, toiles de remplacement, accessoires) avec option de livraison.
2. **Location d'abris** (abris temporaires saisonniers).
3. **Installation** (service à domicile planifié via un système de réservation).

Le but est double :
- Rendre le e-commerce fonctionnel pour déploiement réel.
- Démontrer des compétences modernes en entretien d'embauche (.NET 10 Clean Architecture + Angular 20+).

---

## Build & Run

### Backend

```bash
dotnet build
dotnet run --project src/Api

# Tests
dotnet test --no-build
dotnet test --collect:"XPlat Code Coverage"

# EF Core — deux contextes (toujours depuis la racine de la solution)
dotnet ef migrations add <Name> \
  --project src/Infrastructure \
  --startup-project src/Api \
  --context AppIdentityDbContext \
  --output-dir Identity/Migrations

dotnet ef migrations add <Name> \
  --project src/Infrastructure \
  --startup-project src/Api \
  --context ApplicationDbContext \
  --output-dir Persistence/Migrations

dotnet ef database update --context AppIdentityDbContext \
  --project src/Infrastructure --startup-project src/Api

dotnet ef database update --context ApplicationDbContext \
  --project src/Infrastructure --startup-project src/Api

# User secrets (dev seulement)
dotnet user-secrets set "Jwt:Key" "<32+chars>" --project src/Api
dotnet user-secrets set "ConnectionStrings:Default" "<conn>" --project src/Api
```

### Frontend

```bash
npm install
ng serve                            # dev — http://localhost:4200
ng build --configuration production # prod (SSR activé)
npx vitest run                      # tests unitaires
ng lint
ng extract-i18n                     # i18n — extraire les strings
```

---

## Structure des projets

### Backend (`src/`)

```
src/
├── Domain/               # Entités, VO, enums, exceptions, interfaces domain
├── Application/          # CQRS handlers, DTOs (records sealed), validateurs, behaviors
├── Infrastructure/       # EF Core, Identity, services externes, DI registration
└── Api/                  # Controllers, middleware, Program.cs (composition root)

tests/
├── Unit/                 # Tests domain + application (pas de DB)
└── Integration/          # Tests avec WebApplicationFactory + DB en mémoire
```

### Frontend (`client/`)

```
client/src/app/
├── core/          # Singleton services, guards, interceptors, providers
├── shared/        # Composants réutilisables, pipes, directives
├── features/      # Dossiers lazy-loaded par domaine métier
└── app.routes.ts  # Route root

client/src/
├── i18n/          # messages.fr.xlf, messages.en.xlf
├── environments/
└── assets/
```

---

## Architecture & Philosophie

### Clean Architecture + CQRS

- **Domain** : zéro dépendance externe. Entités, VO, exceptions, règles métier pures.
- **Application** : orchestration des use cases via Mediator maison. Dépend seulement de Domain.
- **Infrastructure** : implémente les interfaces d'Application. Jamais référencé par Application directement.
- **Api** : couche mince — mappe HTTP → Mediator, aucune logique métier.

Règle d'or : les dépendances ne pointent **jamais** vers l'extérieur.

```
Domain ← Application ← Infrastructure
                     ← Api
```

### Mediator maison (pas MediatR)

On utilise le **Mediator Pattern source-generated** (`Mediator` NuGet, ou implémentation custom).
Aucune référence à MediatR dans le projet.

```csharp
// IQuery / ICommand / IQueryHandler / ICommandHandler définis dans Application/Common
public interface IQueryHandler<TQuery, TResult>
    where TQuery : IQuery<TResult>
{
    ValueTask<TResult> Handle(TQuery query, CancellationToken ct);
}
```

### EF Core — pas de Repository Pattern inutile

Suivant la recommandation 2025-2026 (LevelUp, codewithmukesh) :
- `IApplicationDbContext` est injecté **directement** dans les handlers.
- Pas de `IRepository<T>` générique — `DbContext` + LINQ suffisent.
- Configurations d'entités dans `IEntityTypeConfiguration<T>` (jamais d'annotations sur les entités).
- Queries read-only → `.AsNoTracking()` systématique.
- Soft delete via `SaveChangesInterceptor` + named query filter (`HasQueryFilter`).

---

## Standards C# (C# 14 / .NET 10)

- **Primary constructors** partout — pas de `private readonly field` + constructeur.
- **File-scoped namespaces** dans chaque `.cs`.
- `is null` / `is not null` (pas `== null`).
- `IReadOnlyList<T>` / `IEnumerable<T>` en return types, pas `List<T>`.
- **`sealed record`** pour tous les DTOs, commands, queries.
- **`Result<T>`** pattern (ErrorOr) pour les chemins d'erreur attendus en Application.
- Pas de magic strings — constantes dans `Domain/Constants/`.
- XML doc comments sur tous les types Domain publics et interfaces Application.

### Exemples de patterns obligatoires

```csharp
// DTO — sealed record
public sealed record ProductDto(Guid Id, string Name, decimal Price, string Category);

// Command — sealed record
public sealed record CreateOrderCommand(
    Guid CustomerId,
    IReadOnlyList<OrderLineDto> Lines,
    DeliveryType DeliveryType) : ICommand<Guid>;

// Query — sealed record
public sealed record GetProductBySlugQuery(string Slug) : IQuery<ProductDto>;

// Handler — primary constructor
internal sealed class GetProductBySlugQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetProductBySlugQuery, ProductDto>
{
    public async ValueTask<ProductDto> Handle(
        GetProductBySlugQuery query, CancellationToken ct)
    {
        var product = await db.Products
            .AsNoTracking()
            .Where(p => p.Slug == query.Slug)
            .Select(p => new ProductDto(p.Id, p.Name, p.Price, p.Category.Name))
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(Product), query.Slug);

        return product;
    }
}
```

---

## Validation

- **FluentValidation** uniquement, dans Application. Jamais dans Domain ni Api.
- `ValidationBehavior` (pipeline Mediator) lève `ValidationException` avant le handler.
- Jamais de `ModelState.IsValid` manuel.
- Validateurs dans le même dossier que leur Command/Query.

---

## Sécurité

- Tous les endpoints nécessitent `RequireAuthorization()` par défaut.
- Endpoints publics : `.AllowAnonymous()` explicite (décision consciente).
- Constantes de rôles dans `Domain/Constants/Roles.cs` (couche la plus intérieure).
- JWT:Key, connection strings → `dotnet user-secrets` (dev) + Azure Key Vault / env vars (prod).

---

## Gestion des erreurs

- Exceptions domain (`NotFoundException`, `ConflictException`, `ForbiddenException`) depuis handlers.
- `GlobalExceptionHandler` (IExceptionHandler) mappe vers RFC 9457 ProblemDetails.
- Zéro try/catch dans les controllers.
- `Result<T>` pour les chemins d'erreur attendus (pas d'exception pour flux normal).

---

## Soft Delete

Via `SaveChangesInterceptor` + `ISoftDeletable` interface + named query filter :

```csharp
public interface ISoftDeletable
{
    bool IsDeleted { get; }
    DateTime? DeletedAt { get; }
}
```

Filtre appliqué globalement dans `ApplicationDbContext.OnModelCreating` :
```csharp
builder.HasQueryFilter(e => !e.IsDeleted);
```

Pour bypasser (admin/audit) : `.IgnoreQueryFilters()`.

---

## Standards Angular (v20+)

- **Standalone components** uniquement — pas de NgModules.
- Ne pas écrire `standalone: true` dans les décorateurs (valeur par défaut en v20+).
- **Signals** pour tout l'état local (`signal()`, `computed()`, `effect()`).
- **`input()` / `output()`** — pas de `@Input()` / `@Output()`.
- `ChangeDetectionStrategy.OnPush` sur chaque composant.
- **Lazy loading** sur toutes les routes de feature.
- `inject()` — pas d'injection dans le constructeur.
- `@if / @for / @switch` — pas de `*ngIf / *ngFor`.
- Pas de `ngClass` / `ngStyle` — utiliser les bindings `[class]` / `[style]`.
- `NgOptimizedImage` pour toutes les images statiques.
- **Reactive forms** — pas de template-driven forms.
- Bindings host dans l'objet `host` du décorateur — pas de `@HostBinding / @HostListener`.

### Accessibilité obligatoire

- Zéro violation AXE.
- WCAG AA minimum : contraste, focus management, ARIA.

---

## Déploiement cible

| Composant | Plateforme |
|-----------|-----------|
| Frontend | Vercel (SSR activé) |
| Backend | Azure App Service (.NET 10) |
| Base de données | Azure SQL (ou PostgreSQL via Npgsql) |
| Secrets | Azure Key Vault |
| CI/CD | GitHub Actions |

---

## Règles de workflow

- **Toujours une feature branch** — jamais commit direct sur `main`.
- `dotnet test` après chaque implémentation backend.
- `npx vitest run` + `ng lint` avant chaque PR.
- **Jamais modifier `Domain/`** sans discussion explicite.
- Commits atomiques, style Conventional Commits : `feat(shelter): add rental booking command`.
- Zéro code commenté (git a l'historique).
- Zéro TODO sans ticket lié.
