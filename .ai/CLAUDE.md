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
# Solution : AbrisAutoOutaouais-WebApp.slnx (format XML .slnx)
dotnet build
dotnet run --project src/AbrisAutoOutaouais-WebApp.API

# Tests (projets à la racine du dépôt)
dotnet test --no-build
dotnet test --collect:"XPlat Code Coverage"
dotnet test AbrisAutoOutaouais-WebApp.UnitTest         # projet unique

# EF Core — un seul DbContext (toujours depuis la racine de la solution)
# --context est optionnel puisqu'il n'y a qu'un contexte
dotnet ef migrations add <Name> \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API \
  --output-dir Persistence/Migrations

dotnet ef database update \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API

# User secrets (dev seulement)
dotnet user-secrets set "Jwt:Key" "<32+chars>" --project src/AbrisAutoOutaouais-WebApp.API
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<conn>" --project src/AbrisAutoOutaouais-WebApp.API
```

### Frontend

```bash
# Depuis src/AbrisAutoOutaouais-WebApp.Client
npm install
npm start            # dev — ng serve --host=127.0.0.1
npm test             # tests unitaires (vitest run)
npm run build:prod   # build production
npm run build:fr     # build localisé (--localize)
npm run i18n:extract # extraire les strings i18n (sortie : src/locale)
```

---

## Structure des projets

### Backend (`src/`)

```
src/
├── AbrisAutoOutaouais-WebApp.Domain/         # Entités, VO, enums, exceptions, interfaces domain
├── AbrisAutoOutaouais-WebApp.Application/     # CQRS handlers, DTOs (records sealed), validateurs, behaviors
├── AbrisAutoOutaouais-WebApp.Infrastructure/ # EF Core, Identity, services externes, DI registration
└── AbrisAutoOutaouais-WebApp.API/            # Controllers, middleware, Program.cs (composition root)

# Projets de test à la racine du dépôt (pas sous un dossier tests/)
AbrisAutoOutaouais-WebApp.UnitTest/         # xUnit v3 + FluentAssertions + NSubstitute (pas de DB)
AbrisAutoOutaouais-WebApp.IntegrationTest/  # WebApplicationFactory + DB en mémoire
```

### Frontend (`src/AbrisAutoOutaouais-WebApp.Client/`)

```
src/AbrisAutoOutaouais-WebApp.Client/src/app/
├── core/          # Singleton services, guards, interceptors, providers
├── shared/        # Composants réutilisables, pipes, directives
├── features/      # Dossiers lazy-loaded par domaine métier
└── app.routes.ts  # Route root

src/AbrisAutoOutaouais-WebApp.Client/src/
├── locale/        # strings i18n extraites
├── environments/
└── assets/
```

---

## Architecture & Philosophie

### Clean Architecture + CQRS

- **Domain** : zéro dépendance externe. Entités, VO, exceptions, règles métier pures.
- **Application** : orchestration des use cases via Mediator maison. Dépend seulement de Domain.
- **Infrastructure** : implémente les interfaces d'Application. Jamais référencé par Application directement.
- **API** : REST Controller — mappe HTTP → Mediator, aucune logique métier.

Règle d'or : les dépendances ne pointent **jamais** vers l'extérieur.

```
Domain ← Application ← Infrastructure
                     ← API
```

### Mediator maison (pas MediatR)

On utilise un **Mediator maison** (implémentation custom). Aucune référence à MediatR dans le projet.

Les interfaces sont définies dans `Application/Common/Mediator/` :
`ICommand<T>`, `IQuery<T>`, `ICommandHandler<,>`, `IQueryHandler<,>`, `IDispatcher`, `Dispatcher`, `Unit`.

Les controllers injectent `IDispatcher` et appellent `await dispatcher.DispatchAsync(command, ct)`.
Les handlers implémentent `HandleAsync(...)` retournant `Task<T>`.

```csharp
// Interfaces dans Application/Common/Mediator/
public interface IQueryHandler<TQuery, TResult>
    where TQuery : IQuery<TResult>
{
    Task<TResult> HandleAsync(TQuery query, CancellationToken ct);
}
```

**Enregistrement DI** :
- `Program.cs` ne fait que `builder.Services.AddScoped<IDispatcher, Dispatcher>();`.
- L'auto-enregistrement des handlers (Scrutor) ET `AddValidatorsFromAssembly` se font dans
  `AddInfrastructure(...)` (`Infrastructure/DependencyInjection.cs`) — pas dans `Program.cs`.
- Le type marqueur d'assembly est `AssemblyMarker` (dans Application).

### EF Core — pas de Repository Pattern inutile

**Un seul DbContext** : `ApplicationDbContext` (`Infrastructure/Persistence/`) hérite de
`IdentityDbContext<AppUser, AppRole, Guid, ...>` ET implémente `IApplicationDbContext`. Il contient
À LA FOIS les tables Identity ET les entités métier, dans la même base. Il n'y a PAS de
`AppIdentityDbContext` ni de seconde chaîne de connexion.

- Chaîne de connexion : clé `DefaultConnection`
  (`Server=(localdb)\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=True`).
- Migrations dans `Infrastructure/Persistence/Migrations` (existantes : `InitialMigration`, `Fix_01_LaunchAPI`).

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
    public async Task<ProductDto> HandleAsync(
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

- **FluentValidation** uniquement, dans Application. Jamais dans Domain ni API.
- `ValidationBehavior` (pipeline Mediator) lève `ValidationException` avant le handler.
- Jamais de `ModelState.IsValid` manuel.
- Validateurs dans le même dossier que leur Command/Query.

---

## Sécurité

- **Pas de politique d'autorisation globale par défaut** : les endpoints ne sont PAS sécurisés
  automatiquement. Ils requièrent un `[Authorize]` explicite ; les endpoints publics portent `[AllowAnonymous]`.
- Identité : `AppUser : IdentityUser<Guid>` et `AppRole : IdentityRole<Guid>` dans
  `Infrastructure/Identity/`. `AppUser` EST le client (pas d'entité `Customer` séparée) ; il possède
  un `DefaultDeliveryAddress` de type `Address` (value object du Domain).
- Constantes de rôles dans `Domain/Constants/Roles.cs` : `Customer`, `Staff`, `Admin`.
- Politiques d'autorisation enregistrées : `StaffOrAbove` (Staff + Admin) et `AdminOnly`.
- Compte admin par défaut seedé au démarrage par `IdentitySeeder.SeedAsync(app.Services)` :
  email `admin@abrisauto.com`, mot de passe `Admin123!`, rôle `Admin`.
- JWT (appsettings.json) : `Jwt:Issuer` = `AbrisAutoOutaouais.API`, `Jwt:Audience` = `AbrisAutoOutaouais.CLIENT`,
  `Jwt:Key` présent en dev.
- Routes API versionnées : `/api/v1/...` (ex. `/api/v1/products`).
- JWT:Key, connection strings → `dotnet user-secrets` (dev) + Azure Key Vault / env vars (prod).

---

## Gestion des erreurs

- Exceptions domain (`NotFoundException`, `ConflictException`, `ForbiddenException`) depuis handlers.
- `GlobalExceptionHandler` (`API/Middlewares/`) mappe vers RFC 9457 ProblemDetails.
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
