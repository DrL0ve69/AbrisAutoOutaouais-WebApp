# Ajouter une fonctionnalité backend (AbrisTempo Local)

Pas-à-pas pour ajouter un cas d'usage (commande ou query) en respectant Clean Architecture + CQRS
+ le **Mediator maison**. Le fil conducteur est le vrai code de `CreateProductCommand`. Pour
l'auth, voir [`identity.md`](identity.md) ; pour l'arborescence, [`project-layout.md`](project-layout.md).

> **Idiome à copier** : `sealed record XxxCommand : ICommand<T>` + handler implémentant
> `ICommandHandler<,>` (Scrutor l'enregistre seul) + validateur FluentValidation **dans le même
> dossier** + un controller mince qui appelle `dispatcher.DispatchAsync(...)`.

---

## 1 · Où poser les fichiers

Un cas d'usage = un dossier sous la feature concernée dans `Application/` :

```
Application/Products/Commands/
├── CreateProductCommand.cs           # le record (contrat)
├── CreateProductCommandHandler.cs    # la logique
└── CreateProductCommandValidator.cs  # FluentValidation (même dossier)
```

Les queries vivent sous `Application/<Feature>/Queries/<NomQuery>/` avec leur DTO de retour à côté.
Le **validateur est toujours dans le même dossier** que sa commande/query.

---

## 2 · La commande — un `sealed record` qui marque `ICommand<T>`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

public sealed record CreateProductCommand(
    string Name,
    string Description,
    decimal Price,
    int StockQuantity,
    Guid CategoryId,
    int? WidthCm = null) : ICommand<Guid>;   // <T> = type retourné (ici l'Id créé)
```

- `ICommand<T>` / `IQuery<T>` viennent de `Application/Common/Mediator/`.
- Une commande sans valeur de retour utilise `ICommand` (= `ICommand<Unit>`).
- DTOs, commandes et queries sont **toujours** des `sealed record`.

---

## 3 · Le handler — logique dans `HandleAsync`, contrat via `Handle`

C'est la subtilité du dispatcher maison. Le handler implémente l'interface `ICommandHandler<,>`
(dont le contrat est `Handle` → `ValueTask<T>`), **mais le `Dispatcher` appelle `HandleAsync`**
(→ `Task<T>`) par dispatch dynamique. On écrit donc la logique dans `HandleAsync` et un `Handle`
mince qui délègue :

```csharp
public sealed class CreateProductCommandHandler(IApplicationDbContext db)
    : ICommandHandler<CreateProductCommand, Guid>
{
    // La logique vit ici — c'est ce que le Dispatcher invoque réellement.
    public async Task<Guid> HandleAsync(CreateProductCommand command, CancellationToken ct)
    {
        var slug = GenerateSlug(command.Name);

        var exists = await db.Products.AnyAsync(p => p.Slug == slug, ct);
        if (exists)
            throw new ConflictException($"Un produit « {command.Name} » existe déjà.");

        var product = Product.Create(command.Name, slug, command.Price, /* … */);
        db.Products.Add(product);
        await db.SaveChangesAsync(ct);
        return product.Id;
    }

    // Satisfait le contrat ICommandHandler<,> (Scrutor scanne cette interface) et délègue.
    public ValueTask<Guid> Handle(CreateProductCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
```

Conventions de handler :
- **Primary constructor** pour la DI ; on injecte `IApplicationDbContext` (jamais le type concret),
  `ICurrentUserService`, `IIdentityService`, etc.
- Lève une **exception de domaine** pour un échec métier (`NotFoundException`, `ConflictException`,
  `ForbiddenException`, `BusinessRuleException`) — `GlobalExceptionHandler` la mappe en
  ProblemDetails RFC 9457. Pas de `try/catch` ici.
- Query → `.AsNoTracking()` + projection `.Select(...)` vers le DTO. Pas de repository générique :
  `IApplicationDbContext` + LINQ suffisent.

---

## 4 · Le validateur — FluentValidation, même dossier

```csharp
public sealed class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.CategoryId).NotEmpty();
        // Champ optionnel : ne valider que s'il est fourni
        RuleFor(x => x.WidthCm!.Value).InclusiveBetween(MinCm, MaxCm)
            .When(x => x.WidthCm.HasValue);
    }
}
```

`ValidationBehavior` (pipeline du Mediator) exécute tous les validateurs **avant** le handler et
lève `ValidationException` en cas d'échec. **Jamais** de `ModelState.IsValid` manuel ni de
validation dans le controller ou le Domain.

---

## 5 · L'enregistrement — rien à faire (Scrutor)

Aucune inscription manuelle. `Infrastructure/DependencyInjection.cs` scanne l'assembly Application :

```csharp
services.Scan(scan => scan
    .FromAssemblies(typeof(AssemblyMarker).Assembly)
    .AddClasses(c => c.AssignableTo(typeof(ICommandHandler<,>)))
        .AsImplementedInterfaces().WithScopedLifetime()
    .AddClasses(c => c.AssignableTo(typeof(IQueryHandler<,>)))
        .AsImplementedInterfaces().WithScopedLifetime());

services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);
```

Tout handler implémentant `ICommandHandler<,>` / `IQueryHandler<,>` et tout `AbstractValidator<T>`
sont donc câblés automatiquement. `Program.cs` n'enregistre que `IDispatcher`.

---

## 6 · Le controller — mince, dispatch only

```csharp
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class ProductsController(IDispatcher dispatcher) : ControllerBase
{
    [HttpGet("{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetProductBySlugQuery(slug), ct));

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] CreateProductCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.DispatchAsync(cmd, ct);
        return CreatedAtAction(nameof(GetBySlug), new { slug = id }, id);
    }
}
```

- Routes **versionnées** (`/api/v1/...`).
- **Aucune** logique métier, pas de `try/catch`, pas de `ModelState`. Le controller mappe HTTP →
  Dispatcher et c'est tout.
- Endpoint public uniquement avec `[AllowAnonymous]` explicite ; sinon `[Authorize]` /
  `[Authorize(Policy = "StaffOrAbove" | "AdminOnly")]`.
- Pour patcher un champ de route dans une commande record : `cmd with { Id = id }`.

---

## 7 · Migration (si le domaine change)

Si la fonctionnalité ajoute/modifie une entité, génère **une** migration sur l'unique contexte (voir
[`identity.md`](identity.md) §10) :

```powershell
dotnet ef migrations add <Name> `
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure `
  --startup-project src/AbrisAutoOutaouais-WebApp.API `
  --output-dir Persistence/Migrations
```

Mapping via `IEntityTypeConfiguration<T>` dans `Infrastructure/Persistence/Configurations/`
(jamais d'annotations sur les entités). Attention aux pièges documentés dans
`.claude/rules/lessons-learned.md` (owned entities, soft-delete + index unique `HasFilter`,
seeders idempotents, `.Contains` non traduit en SQL…).

---

## 8 · Tester & vérifier

- **Test du handler** : xUnit v3 + FluentAssertions + NSubstitute (`AbrisAutoOutaouais-WebApp.UnitTest`).
- **Test d'intégration** : `WebApplicationFactory` (`AbrisAutoOutaouais-WebApp.IntegrationTest`,
  provider EF InMemory) — toute classe touchant `WebAppFactory` porte `[Collection("Integration")]`.
- `dotnet test` après tout changement backend, puis un passage `solid-review` sur le diff.
- Le provider InMemory **diverge** du SQL Server réel : pour un seeder ou une requête `.Contains`,
  faire un aller-retour live sur LocalDB (lessons L-022, L-035, L-038).

---

## Récapitulatif (checklist)

1. `sealed record XxxCommand : ICommand<T>` (ou `IQuery<T>`) dans `Application/<Feature>/…`.
2. Handler `ICommandHandler<XxxCommand, T>` : logique dans `HandleAsync`, `Handle` délègue.
3. Validateur `AbstractValidator<XxxCommand>` dans le **même dossier**.
4. Rien à enregistrer (Scrutor + `AddValidatorsFromAssembly`).
5. Controller mince : `dispatcher.DispatchAsync(...)`, `[Authorize]`/`[AllowAnonymous]` explicite.
6. Migration si le domaine change (un seul contexte).
7. `dotnet test` + `solid-review`.
