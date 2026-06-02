# ARCHITECTURE_DECISIONS.md — AbrisTempo Local

Décisions architecturales documentées avec justification.
À lire avant de commencer à coder une nouvelle feature.

---

## 1. Pas de Repository Pattern générique

### Décision
`IApplicationDbContext` est injecté directement dans les handlers CQRS. Pas de `IRepository<T>` générique.

### Justification
- EF Core `DbContext` **est déjà** une implémentation du pattern Unit of Work et du pattern Collection.
- `IRepository<T>` générique duplique ce que LINQ + DbSet offrent nativement.
- Tester avec EF Core InMemory ou SQLite suffit pour les tests d'intégration.
- Sources : levelup.gitconnected.com (2026), codewithmukesh.com Clean Architecture .NET 10.

### Exception permise
Des méthodes de query complexes et réutilisées peuvent être extraites en **Query Objects** (classes) dans Application — pas une interface Repository.

```csharp
// ✅ Acceptable — query object réutilisable
public static class ProductQueries
{
    public static IQueryable<ProductDto> ToDto(this IQueryable<Product> q) =>
        q.Select(p => new ProductDto(p.Id, p.Name, p.Slug, p.Price, p.Category.Name, ...));
}

// ❌ À éviter — abstraction inutile
public interface IProductRepository
{
    Task<Product?> GetBySlugAsync(string slug, CancellationToken ct);
    Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken ct);
    // ... reduplique ce que DbSet + LINQ font déjà
}
```

---

## 2. Mediator maison (pas MediatR)

### Décision
Pattern CQRS via interfaces `ICommandHandler<T,R>` / `IQueryHandler<T,R>` + `Dispatcher` maison.

### Justification
- MediatR est devenu commercial pour les usages en production.
- Le Mediator Pattern est simple à implémenter (< 50 lignes).
- Moins de dépendances NuGet = moins de surface d'attaque + build plus rapide.
- Performance légèrement meilleure (pas de reflection MediatR).

### Alternative NuGet acceptée
`Mediator` de martinothamar (source-generated, gratuit, open-source) est acceptable si tu veux les pipeline behaviors automatiques.

---

## 3. Deux DbContext séparés

### Décision
- `AppIdentityDbContext` : ASP.NET Core Identity (Users, Roles, Claims, Tokens).
- `ApplicationDbContext` : Entités métier (Products, Orders, Bookings, Rentals).

### Justification
- Migrations indépendantes (Identity évolue rarement, le domaine souvent).
- Testabilité : les tests domain n'ont pas besoin du contexte Identity.
- Séparation claire entre infrastructure d'auth et logique métier.
- Pas de FK cross-context — `OwnerId` (Guid) dans les entités métier référence `ApplicationUser.Id` sans contrainte EF.

### Comment gérer la jointure ?
En Application, via `ICurrentUserService` qui expose `UserId`. Les handlers récupèrent l'entité Customer via ce Guid.

---

## 4. Soft Delete via Interceptor

### Décision
`SoftDeleteInterceptor : SaveChangesInterceptor` intercepte `EntityState.Deleted` et le convertit en `IsDeleted = true`.

### Justification
- Aucun `context.Products.Remove(product)` dans le code applicatif — comportement transparent.
- Named query filter (`HasQueryFilter(p => !p.IsDeleted)`) exclus automatiquement les soft-deleted de toutes les queries.
- Pour l'admin (voir les supprimés) : `.IgnoreQueryFilters()`.
- Index filtré sur `Slug` (ex: `WHERE [IsDeleted] = 0`) pour permettre la réutilisation d'un slug supprimé.

### Cascade soft delete
Le `SoftDeleteInterceptor` gère également les entités liées via navigation :
```csharp
// Dans SoftDeleteInterceptor — cascade sur les enfants chargés
foreach (var entry in deletedEntries)
{
    foreach (var navEntry in entry.References
        .Where(r => r.IsLoaded)
        .SelectMany(r => r.TargetEntry?.Context.Entry(r.CurrentValue!)
            .Collections.SelectMany(c => c.CurrentValue!.Cast<ISoftDeletable>()) ?? []))
    {
        navEntry.IsDeleted = true;
        navEntry.DeletedAt = DateTime.UtcNow;
    }
}
```

---

## 5. `sealed record` pour DTOs, Commands, Queries

### Décision
Tous les DTOs, Commands et Queries sont des `sealed record`.

### Justification
- Immutabilité par défaut (`init` accessors).
- Value equality gratuite (pratique pour les tests et le caching).
- `sealed` = pas d'héritage non intentionnel.
- Moins de boilerplate que les classes.

```csharp
// ✅ Correct
public sealed record CreateOrderCommand(
    Guid CustomerId,
    IReadOnlyList<OrderLineDto> Lines,
    DeliveryType DeliveryType) : ICommand<Guid>;

// ❌ À éviter
public class CreateOrderCommand
{
    public Guid CustomerId { get; set; }
    // mutable, pas d'equality, verbeux
}
```

---

## 6. `Result<T>` pour les erreurs attendues

### Décision
En Application, les chemins d'erreur **attendus** (ex: produit en rupture de stock lors d'un ajout au panier) retournent `Result<T>` plutôt qu'une exception.
Les erreurs **inattendues** (ex: DB indisponible) restent des exceptions.

### Règle pratique

| Situation | Approche |
|-----------|---------|
| Produit introuvable (404 logique) | `throw new NotFoundException(...)` |
| Slug déjà utilisé (409 logique) | `throw new ConflictException(...)` |
| Stock insuffisant (métier attendu) | `return Result.Failure("Stock insuffisant")` |
| DB timeout | Exception non gérée → 500 |

---

## 7. Constantes dans `Domain/Constants/`

### Décision
Rôles, claim types, noms de policy → `Domain/Constants/`.

### Justification
Domain est la couche la plus intérieure. Application, Infrastructure et Api peuvent tous la référencer sans violer les règles de dépendance.
Si `Roles` était dans `Api`, les handlers Application ne pourraient pas l'utiliser.

---

## 8. Angular — Signals + OnPush partout

### Décision
- `signal()` pour tout l'état local.
- `computed()` pour l'état dérivé.
- `ChangeDetectionStrategy.OnPush` sur tous les composants.
- Zéro `ngOnInit` avec BehaviorSubject — remplacé par signals + `effect()`.

### Justification
- Détection de changement fine-grained → meilleures performances.
- Plus lisible que les chaînes RxJS pour l'état UI simple.
- Angular 20+ : les signals sont le modèle officiel recommandé.

### Quand utiliser RxJS ?
Uniquement pour les opérations asynchrones multi-valeurs (HTTP via `HttpClient`, formulaires réactifs complexes) — pas pour l'état UI.

---

## 9. SSR activé (Angular + Vercel)

### Décision
SSR activé dès le départ via `@angular/ssr`.

### Justification
- SEO : les pages catalogue sont indexables par les moteurs de recherche.
- Performance : LCP amélioré (HTML rendu côté serveur).
- Vercel détecte automatiquement les projets Angular SSR.

### Contraintes SSR
- Toujours utiliser `isPlatformBrowser()` pour les accès `localStorage`, `window`, `document`.
- Jamais de `document.querySelector` dans les composants.

---

## 10. API Versioning

### Décision
Versioning URL par défaut (`/api/v1/`, `/api/v2/`).

### Justification
- Le frontend et le backend peuvent évoluer indépendamment.
- Facilite le déploiement progressif.
- Pattern standard pour les APIs publiques.

```csharp
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class ProductsController : ControllerBase { ... }
```
