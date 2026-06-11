# LAYER_APPLICATION.md — Couche Application

Orchestration des use cases via CQRS + Mediator maison.
Dépend uniquement de `Domain`. Ignore totalement EF Core, Identity, HTTP.

---

## Règle d'or

Application ne sait pas **comment** les données sont stockées ni **comment**
les emails sont envoyés — elle déclare des interfaces (`IApplicationDbContext`,
`IEmailService`…) que Infrastructure implémente.

---

## Arborescence complète

> **État actuel** : seule une partie des features est implémentée. L'arborescence
> ci-dessous reflète le code réel. Les features non encore présentes (UpdateProduct,
> DeleteProduct, CancelOrder, tout le dossier `Rentals/`, les commandes Booking,
> `UpdateProfile`, `ChangePassword`, `GetMyProfile`…) sont **aspirationnelles** et
> seront ajoutées au fur et à mesure. Noter que les features réelles utilisent un
> dossier **plat** (`Products/Commands/CreateProductCommand.cs`), pas un sous-dossier
> par feature.

```
src/AbrisAutoOutaouais-WebApp.Application/
├── AbrisAutoOutaouais-WebApp.Application.csproj
├── AssemblyMarker.cs               ← classe vide pour typeof(AssemblyMarker).Assembly
│
├── Common/
│   ├── Mediator/
│   │   ├── ICommand.cs             ← marqueurs ICommand<TResult> + ICommand
│   │   ├── IQuery.cs               ← marqueur IQuery<TResult>
│   │   ├── ICommandHandler.cs      ← interface handler de commande
│   │   ├── IQueryHandler.cs        ← interface handler de query
│   │   ├── IDispatcher.cs          ← interface du dispatcher (DispatchAsync)
│   │   ├── Unit.cs                 ← type "void" pour ICommand sans résultat
│   │   └── Dispatcher.cs           ← implémentation, résolution via IServiceProvider
│   │
│   ├── Interfaces/
│   │   ├── IApplicationDbContext.cs   ← accès aux DbSets (sans AppUser)
│   │   ├── IIdentityService.cs        ← opérations auth (login, register, rôles) + AuthResponse
│   │   ├── ICurrentUserService.cs     ← userId, email, rôles depuis HTTP context
│   │   ├── IEmailService.cs           ← envoi d'emails
│   │   ├── IFileStorageService.cs     ← upload / delete de fichiers
│   │   └── IDateTimeProvider.cs       ← abstraction de DateTime.UtcNow (testabilité)
│   │
│   ├── Behaviors/
│   │   └── ValidationBehavior.cs   ← pipeline FluentValidation avant chaque handler
│   │
│   └── Models/
│       ├── Result.cs               ← Result / Result<T> (succès / erreur sans exception)
│       └── PaginatedList.cs        ← liste paginée générique
│
├── Products/
│   ├── Commands/                   ← dossier PLAT (pas de sous-dossier par feature)
│   │   ├── CreateProductCommand.cs
│   │   ├── CreateProductCommandHandler.cs
│   │   └── CreateProductCommandValidator.cs
│   └── Queries/
│       ├── GetAllProducts/
│       │   ├── GetAllProductsQuery.cs
│       │   └── GetAllProductsQueryHandler.cs
│       └── GetProductBySlug/
│           ├── GetProductBySlugQuery.cs
│           ├── GetProductBySlugQueryHandler.cs
│           └── ProductDto.cs       ← réutilisé par GetAllProducts
│
├── Orders/
│   └── Commands/
│       └── PlaceOrder/
│           ├── PlaceOrderCommand.cs
│           ├── PlaceOrderCommandHandler.cs
│           └── PlaceOrderCommandValidator.cs
│
├── Bookings/
│   └── Queries/
│       └── GetAvailableSlots/
│           ├── GetAvailableSlotsQuery.cs        ← contient aussi AvailableSlotDto
│           └── GetAvailableSlotsQueryHandler.cs
│
└── Auth/
    ├── Login/
    │   └── LoginCommand.cs          ← Command + Handler dans le même fichier
    ├── Register/
    │   └── RegisterCommand.cs       ← Command + Handler dans le même fichier
    └── DTOs/
        └── AddressDto.cs
```

---

## Application.csproj

```xml
<!-- src/AbrisAutoOutaouais-WebApp.Application/AbrisAutoOutaouais-WebApp.Application.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\AbrisAutoOutaouais-WebApp.Domain\AbrisAutoOutaouais-WebApp.Domain.csproj" />
    <PackageReference Include="FluentValidation" Version="12.*" />
    <PackageReference Include="Microsoft.Extensions.DependencyInjection.Abstractions" Version="10.*" />
  </ItemGroup>
</Project>
```

---

## Common/Mediator/

### `Unit.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>Type "void" typé — permet ICommand sans résultat significatif.</summary>
public readonly struct Unit
{
    public static readonly Unit Value = new();
}
```

### `ICommand.cs` + `IQuery.cs`

```csharp
// ICommand.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

public interface ICommand<TResult> { }
public interface ICommand : ICommand<Unit> { }  // commande sans retour

// IQuery.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

public interface IQuery<TResult> { }  // query = lecture pure, jamais de mutation
```

### `ICommandHandler.cs` + `IQueryHandler.cs`

```csharp
// ICommandHandler.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

public interface ICommandHandler<TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    ValueTask<TResult> Handle(TCommand command, CancellationToken ct);
}

public interface ICommandHandler<TCommand> : ICommandHandler<TCommand, Unit>
    where TCommand : ICommand { }

// IQueryHandler.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

public interface IQueryHandler<TQuery, TResult>
    where TQuery : IQuery<TResult>
{
    ValueTask<TResult> Handle(TQuery query, CancellationToken ct);
}
```

### `IDispatcher.cs`

C'est l'abstraction injectée dans les controllers. Une seule méthode publique,
`DispatchAsync`, surchargée pour les commandes ET les queries.

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>Dispatcher CQRS simplifié.</summary>
public interface IDispatcher
{
    Task<TResult> DispatchAsync<TResult>(ICommand<TResult> command, CancellationToken cancellationToken = default);
    Task<TResult> DispatchAsync<TResult>(IQuery<TResult> query, CancellationToken cancellationToken = default);
}
```

### `Dispatcher.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>
/// Dispatcher Mediator maison — résolution du handler via IServiceProvider.
/// Scrutor enregistre automatiquement tous les handlers (voir Infrastructure/DependencyInjection.cs).
/// </summary>
public sealed class Dispatcher(IServiceProvider sp) : IDispatcher
{
    // ── Commandes ─────────────────────────────────────────────────────────────
    public Task<TResult> DispatchAsync<TResult>(
        ICommand<TResult> command, CancellationToken cancellationToken = default)
    {
        var handlerType = typeof(ICommandHandler<,>)
            .MakeGenericType(command.GetType(), typeof(TResult));
        dynamic handler = sp.GetRequiredService(handlerType);
        return handler.HandleAsync((dynamic)command, cancellationToken);
    }

    // ── Queries ───────────────────────────────────────────────────────────────
    public Task<TResult> DispatchAsync<TResult>(
        IQuery<TResult> query, CancellationToken cancellationToken = default)
    {
        var handlerType = typeof(IQueryHandler<,>)
            .MakeGenericType(query.GetType(), typeof(TResult));
        dynamic handler = sp.GetRequiredService(handlerType);
        return handler.HandleAsync((dynamic)query, cancellationToken);
    }
}
```

---

## Common/Interfaces/

### `IApplicationDbContext.cs`

`AppUser` n'est pas exposé ici — Application ne dépend pas d'Infrastructure.
Les handlers qui ont besoin de données utilisateur passent par `IIdentityService`.

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Abstraction du DbContext — injectée directement dans les handlers CQRS.
/// Pas de Repository Pattern générique.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<Product>         Products          { get; }
    DbSet<ProductCategory> ProductCategories { get; }
    DbSet<Order>           Orders            { get; }
    DbSet<OrderLine>       OrderLines        { get; }
    DbSet<RentalContract>  RentalContracts   { get; }
    DbSet<BookingSlot>     BookingSlots      { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
```

### `IIdentityService.cs` + `ICurrentUserService.cs`

Voir **IDENTITY.md** pour le code complet — ces interfaces y sont définies
et documentées en détail.

### `IEmailService.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

public interface IEmailService
{
    Task SendOrderConfirmationAsync(Guid orderId, string toEmail, CancellationToken ct = default);
    Task SendBookingConfirmationAsync(Guid bookingId, string toEmail, CancellationToken ct = default);
    Task SendRentalContractAsync(Guid rentalId, string toEmail, CancellationToken ct = default);
    Task SendPasswordResetAsync(string toEmail, string resetLink, CancellationToken ct = default);
}
```

### `IDateTimeProvider.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Abstraction de DateTime.UtcNow pour les tests unitaires.
/// Dans les tests, on injecte un mock avec une date fixe.
/// </summary>
public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}
```

### `IFileStorageService.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

public interface IFileStorageService
{
    /// <summary>Stocke un fichier, retourne son URL publique.</summary>
    Task<string> SaveAsync(Stream fileStream, string fileName, string contentType,
        CancellationToken ct = default);
    Task DeleteAsync(string fileUrl, CancellationToken ct = default);
}
```

---

## Common/Models/

### `Result.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Models;

/// <summary>
/// Représente le succès ou l'échec d'une opération SANS lancer d'exception.
/// Utiliser pour les chemins d'erreur attendus (validation métier légère).
/// Utiliser les exceptions Domain pour les violations sérieuses (NotFoundException, etc.).
/// </summary>
public sealed class Result
{
    public bool    IsSuccess { get; }
    public string? Error     { get; }

    private Result(bool success, string? error) { IsSuccess = success; Error = error; }

    public static Result Success()              => new(true, null);
    public static Result Failure(string error) => new(false, error);
}

public sealed class Result<T>
{
    public bool    IsSuccess { get; }
    public T?      Value     { get; }
    public string? Error     { get; }

    private Result(bool success, T? value, string? error)
    { IsSuccess = success; Value = value; Error = error; }

    public static Result<T> Success(T value) => new(true, value, null);
    public static Result<T> Failure(string error) => new(false, default, error);
}
```

### `PaginatedList.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Models;

public sealed class PaginatedList<T>
{
    public IReadOnlyList<T> Items      { get; }
    public int              TotalCount { get; }
    public int              PageNumber { get; }
    public int              PageSize   { get; }
    public int              TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool             HasNext    => PageNumber < TotalPages;
    public bool             HasPrev    => PageNumber > 1;

    public PaginatedList(IReadOnlyList<T> items, int totalCount, int pageNumber, int pageSize)
    { Items = items; TotalCount = totalCount; PageNumber = pageNumber; PageSize = pageSize; }

    public static async Task<PaginatedList<T>> CreateAsync(
        IQueryable<T> source, int pageNumber, int pageSize, CancellationToken ct = default)
    {
        var count = await source.CountAsync(ct);
        var items = await source
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return new PaginatedList<T>(items, count, pageNumber, pageSize);
    }
}
```

---

## Common/Behaviors/

### `ValidationBehavior.cs`

S'insère dans le pipeline du Dispatcher avant chaque handler.
Lance `ValidationException` si la validation échoue — interceptée par `GlobalExceptionHandler`.

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Behaviors;

/// <summary>
/// Pipeline behavior — valide la commande/query avant de la passer au handler.
/// Enregistré comme décorateur dans DependencyInjection.cs (Scrutor).
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    where TRequest : notnull
{
    public async ValueTask<TResponse> Handle(
        TRequest request,
        Func<ValueTask<TResponse>> next,
        CancellationToken ct)
    {
        if (!validators.Any()) return await next();

        var context = new ValidationContext<TRequest>(request);
        var results = await Task.WhenAll(validators.Select(v => v.ValidateAsync(context, ct)));
        var failures = results.SelectMany(r => r.Errors).Where(f => f is not null).ToList();

        if (failures.Count != 0)
            throw new ValidationException(failures);

        return await next();
    }
}
```

---

## Exemples de features

### Products — Query avec DTO

```csharp
// Products/Queries/GetProductBySlug/GetProductBySlugQuery.cs
namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;

public sealed record GetProductBySlugQuery(string Slug) : IQuery<ProductDto>;

// Products/Queries/GetProductBySlug/ProductDto.cs
public sealed record ProductDto(
    Guid     Id,
    string   Name,
    string   Slug,
    string?  Description,
    decimal  Price,
    decimal? RentalPrice,
    int      Stock,
    bool     IsAvailable,
    string   CategoryName,
    IReadOnlyList<string> ImageUrls);

// Products/Queries/GetProductBySlug/GetProductBySlugQueryHandler.cs
public sealed class GetProductBySlugQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetProductBySlugQuery, ProductDto>
{
    public async ValueTask<ProductDto> Handle(
        GetProductBySlugQuery query, CancellationToken ct)
    {
        // AsNoTracking() obligatoire sur les queries — pas de tracking EF inutile
        return await db.Products
            .AsNoTracking()
            .Where(p => p.Slug == query.Slug)
            .Select(p => new ProductDto(
                p.Id, p.Name, p.Slug, p.Description, p.Price, p.RentalPrice,
                p.Stock, p.IsAvailable, p.Category.Name,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList()))
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(Product), query.Slug);
    }
}
```

---

### Orders — Command avec handler complet

```csharp
// Orders/Commands/PlaceOrder/PlaceOrderCommand.cs
namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;

public sealed record OrderLineRequest(Guid ProductId, int Quantity);

public sealed record PlaceOrderCommand(
    IReadOnlyList<OrderLineRequest> Lines,
    DeliveryType                    DeliveryType,
    AddressDto?                     ShippingAddress) : ICommand<Guid>;

// Orders/Commands/PlaceOrder/PlaceOrderCommandHandler.cs
internal sealed class PlaceOrderCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService   currentUser,
    IEmailService         email) : ICommandHandler<PlaceOrderCommand, Guid>
{
    public async ValueTask<Guid> Handle(PlaceOrderCommand cmd, CancellationToken ct)
    {
        // 1. Charger les produits demandés
        var productIds = cmd.Lines.Select(l => l.ProductId).ToList();
        var products = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync(ct);

        if (products.Count != productIds.Count)
            throw new BusinessRuleException("Un ou plusieurs produits sont introuvables.");

        // 2. Construire les paires (produit, quantité)
        var items = cmd.Lines
            .Select(l => (Product: products.First(p => p.Id == l.ProductId), Qty: l.Quantity))
            .ToList();

        // 3. Construire l'adresse si livraison
        Address? address = cmd.ShippingAddress is { } a
            ? Address.Create(a.Street, a.City, a.Province, a.PostalCode)
            : null;

        // 4. Créer l'agrégat — les règles métier sont dans Order.Create()
        var order = Order.Create((Guid)currentUser.UserId!, cmd.DeliveryType, items, address);

        // 5. Décrémenter le stock
        foreach (var (product, qty) in items)
            product.AdjustStock(-qty);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        // 6. Email de confirmation (fire and forget acceptable)
        await email.SendOrderConfirmationAsync(order.Id, currentUser.Email!, ct);

        return order.Id;
    }
}

// Orders/Commands/PlaceOrder/PlaceOrderCommandValidator.cs
public sealed class PlaceOrderCommandValidator : AbstractValidator<PlaceOrderCommand>
{
    public PlaceOrderCommandValidator()
    {
        RuleFor(x => x.Lines).NotEmpty().WithMessage("La commande doit contenir au moins un produit.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.ProductId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("Quantité doit être positive.");
        });

        When(x => x.DeliveryType == DeliveryType.Delivery, () =>
        {
            RuleFor(x => x.ShippingAddress).NotNull()
                .WithMessage("Adresse requise pour la livraison.");
            RuleFor(x => x.ShippingAddress!.Street).NotEmpty();
            RuleFor(x => x.ShippingAddress!.City).NotEmpty();
            RuleFor(x => x.ShippingAddress!.PostalCode)
                .Matches(@"^[A-Z]\d[A-Z]\d[A-Z]\d$")
                .WithMessage("Format de code postal invalide (ex: J7T1A1).");
        });
    }
}
```

---

### Bookings — Query créneaux disponibles

```csharp
// Bookings/Queries/GetAvailableSlots/GetAvailableSlotsQuery.cs
namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAvailableSlots;

public sealed record GetAvailableSlotsQuery(
    DateOnly From,
    DateOnly To) : IQuery<IReadOnlyList<AvailableSlotDto>>;

public sealed record AvailableSlotDto(DateTime Start, DateTime End);

// Bookings/Queries/GetAvailableSlots/GetAvailableSlotsQueryHandler.cs
public sealed class GetAvailableSlotsQueryHandler(
    IApplicationDbContext db,
    IDateTimeProvider     clock) : IQueryHandler<GetAvailableSlotsQuery, IReadOnlyList<AvailableSlotDto>>
{
    private static readonly TimeSpan WorkStart    = TimeSpan.FromHours(8);
    private static readonly TimeSpan WorkEnd      = TimeSpan.FromHours(17);
    private static readonly TimeSpan SlotDuration = TimeSpan.FromHours(2);

    public async ValueTask<IReadOnlyList<AvailableSlotDto>> Handle(
        GetAvailableSlotsQuery query, CancellationToken ct)
    {
        var fromUtc = query.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toUtc   = query.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        // Créneaux déjà réservés dans la période
        var booked = await db.BookingSlots
            .AsNoTracking()
            .Where(b =>
                b.Status != BookingStatus.Cancelled &&
                b.SlotStart >= fromUtc &&
                b.SlotStart <= toUtc)
            .Select(b => new { b.SlotStart, b.DurationMin })
            .ToListAsync(ct);

        // Générer tous les créneaux de 2h et filtrer ceux qui sont pris
        var slots = new List<AvailableSlotDto>();
        for (var day = query.From; day <= query.To; day = day.AddDays(1))
        {
            if (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;

            var dayStart = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) + WorkStart;
            var dayEnd   = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) + WorkEnd;

            for (var slot = dayStart; slot + SlotDuration <= dayEnd; slot += SlotDuration)
            {
                var slotEnd = slot + SlotDuration;
                var isBooked = booked.Any(b =>
                    b.SlotStart < slotEnd &&
                    b.SlotStart.AddMinutes(b.DurationMin) > slot);

                if (!isBooked && slot > clock.UtcNow)
                    slots.Add(new AvailableSlotDto(slot, slotEnd));
            }
        }

        return slots.AsReadOnly();
    }
}
```

---

## DTOs Auth (dans Auth/DTOs/)

```csharp
// Auth/DTOs/AddressDto.cs
namespace AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;

/// <summary>DTO partagé — utilisé dans les commandes et les réponses de profil.</summary>
public sealed record AddressDto(
    string Street,
    string City,
    string Province,
    string PostalCode,
    string Country = "Canada");
```

> Les autres DTOs Auth (`AuthResponse`, `UserProfileDto`, `UpdateProfileRequest`) sont
> dans **IDENTITY.md** section 7.

---

## Récapitulatif — ce qui appartient (et n'appartient PAS) à Application

| ✅ Appartient à Application | ❌ N'appartient PAS à Application |
|----------------------------|----------------------------------|
| Handlers CQRS | Entités EF Core / DbContext concret |
| Interfaces IApplicationDbContext, IIdentityService | AppUser / IdentityUser |
| DTOs (sealed records) | Middleware HTTP |
| Validateurs FluentValidation | Controllers |
| Result\<T\>, PaginatedList\<T\> | Envoi d'emails (impl) |
| Dispatcher maison (`IDispatcher`/`Dispatcher`) | Stockage de fichiers (impl) |
| `ValidationBehavior` (FluentValidation) | JWT token generation |
