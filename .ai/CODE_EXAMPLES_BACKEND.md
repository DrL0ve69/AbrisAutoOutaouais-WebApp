# CODE_EXAMPLES_BACKEND.md — AbrisTempo Local

Exemples de code copiables-collables pour chaque couche du backend.
Tous suivent les meilleures pratiques C# 14 / .NET 10 / EF Core 10 (2026).

---

## Domain

### `Domain/Constants/Roles.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Constants;

/// <summary>
/// Constantes de rôles métier — dans Domain pour être accessible depuis toutes les couches
/// sans violer les règles de dépendance (Application, Infrastructure, API dépendent de Domain).
/// </summary>
public static class Roles
{
    public const string Customer   = nameof(Customer);
    public const string Staff      = nameof(Staff);
    public const string Admin      = nameof(Admin);

    // Combinaisons pour [Authorize(Roles = ...)]
    public const string StaffOrAbove    = $"{Staff},{Admin}";
    public const string All             = $"{Customer},{Staff},{Admin}";
}
```

---

### `Domain/Interfaces/ISoftDeletable.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Interfaces;

/// <summary>
/// Marque une entité comme soft-deletable.
/// L'intercepteur EF Core intercepte les suppressions et met IsDeleted à true.
/// </summary>
public interface ISoftDeletable
{
    bool      IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}
```

---

### `Domain/Interfaces/IAuditableEntity.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Interfaces;

public interface IAuditableEntity
{
    DateTime  CreatedAt { get; set; }
    string?   CreatedBy { get; set; }
    DateTime? UpdatedAt { get; set; }
    string?   UpdatedBy { get; set; }
}
```

---

### `Domain/Exceptions/DomainExceptions.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Exceptions;

// Toutes les exceptions Domain sont regroupées dans ce seul fichier.

public sealed class NotFoundException(string name, object key)
    : Exception($"Ressource « {name} » avec la clé « {key} » introuvable.");

public sealed class ConflictException(string message) : Exception(message);

public sealed class ForbiddenException(string message) : Exception(message);

public sealed class BusinessRuleException(string message) : Exception(message);
```

---

### `Domain/ValueObjects/Address.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.ValueObjects;

/// <summary>
/// Objet valeur immuable représentant une adresse de livraison ou d'installation.
/// Stocké comme Owned Entity dans EF Core (pas de table séparée, colonnes préfixées).
/// </summary>
public sealed class Address
{
    public string  Street     { get; init; } = string.Empty;
    public string  City       { get; init; } = string.Empty;
    public string  Province   { get; init; } = "QC";
    public string  PostalCode { get; init; } = string.Empty;
    public string  Country    { get; init; } = "Canada";

    // Validation légère dans le VO lui-même
    public static Address Create(string street, string city, string province, string postalCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(street);
        ArgumentException.ThrowIfNullOrWhiteSpace(city);
        ArgumentException.ThrowIfNullOrWhiteSpace(postalCode);

        return new Address
        {
            Street     = street.Trim(),
            City       = city.Trim(),
            Province   = province.Trim().ToUpperInvariant(),
            PostalCode = postalCode.Trim().ToUpperInvariant(),
        };
    }
}
```

---

### `Domain/Entities/Product.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Produit du catalogue (abri, toile, accessoire).
/// Seule méthode factory Create() crée un état valide — impossible de construire un Product invalide.
/// </summary>
public sealed class Product : ISoftDeletable, IAuditableEntity
{
    private readonly List<ProductImage> _images = [];

    public Guid     Id          { get; private set; }
    public string   Name        { get; private set; } = string.Empty;
    public string   Slug        { get; private set; } = string.Empty;  // URL-friendly
    public string?  Description { get; private set; }
    public decimal  Price       { get; private set; }
    public decimal? RentalPrice { get; private set; }  // null si non louable
    public int      Stock       { get; private set; }
    public bool     IsAvailable { get; private set; }
    public Guid     CategoryId  { get; private set; }

    // Navigation (pas de FK cross-context — juste un Guid)
    public ProductCategory Category { get; private set; } = null!;

    public IReadOnlyList<ProductImage> Images => _images.AsReadOnly();

    // ISoftDeletable
    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    // IAuditableEntity
    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

    private Product() { }  // EF Core

    /// <summary>Seul point de création valide d'un produit.</summary>
    public static Product Create(
        string   name,
        string   slug,
        decimal  price,
        int      stock,
        Guid     categoryId,
        string?  description  = null,
        decimal? rentalPrice  = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        if (price <= 0)  throw new ArgumentException("Le prix doit être positif.", nameof(price));
        if (stock < 0)   throw new ArgumentException("Le stock ne peut pas être négatif.", nameof(stock));

        return new Product
        {
            Id          = Guid.NewGuid(),
            Name        = name.Trim(),
            Slug        = slug.Trim().ToLowerInvariant(),
            Price       = price,
            RentalPrice = rentalPrice,
            Stock       = stock,
            IsAvailable = stock > 0,
            CategoryId  = categoryId,
            Description = description?.Trim(),
        };
    }

    public void UpdateDetails(string name, string? description, decimal price)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (price <= 0) throw new ArgumentException("Le prix doit être positif.", nameof(price));

        Name        = name.Trim();
        Description = description?.Trim();
        Price       = price;
    }

    public void AdjustStock(int delta)
    {
        var newStock = Stock + delta;
        if (newStock < 0)
            throw new BusinessRuleException("Le stock ne peut pas être négatif.");

        Stock       = newStock;
        IsAvailable = newStock > 0;
    }
}
```

---

### `Domain/Entities/BookingSlot.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Créneau d'installation ou de livraison réservé par un client.
/// </summary>
public sealed class BookingSlot : ISoftDeletable, IAuditableEntity
{
    public Guid          Id          { get; private set; }
    public Guid          CustomerId  { get; private set; }
    public Guid?         OrderId     { get; private set; }     // lié à une commande optionnellement
    public DateTime      SlotStart   { get; private set; }
    public int           DurationMin { get; private set; }     // en minutes
    public BookingStatus Status      { get; private set; }
    public BookingType   Type        { get; private set; }     // Installation / Livraison
    public Address       Address     { get; private set; } = null!;
    public string?       Notes       { get; private set; }

    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

    private BookingSlot() { }

    public static BookingSlot Create(
        Guid        customerId,
        DateTime    slotStart,
        int         durationMin,
        BookingType type,
        Address     address,
        Guid?       orderId = null,
        string?     notes   = null)
    {
        if (slotStart <= DateTime.UtcNow)
            throw new BusinessRuleException("Le créneau doit être dans le futur.");
        if (durationMin <= 0)
            throw new ArgumentException("La durée doit être positive.", nameof(durationMin));

        return new BookingSlot
        {
            Id          = Guid.NewGuid(),
            CustomerId  = customerId,
            OrderId     = orderId,
            SlotStart   = slotStart,
            DurationMin = durationMin,
            Type        = type,
            Status      = BookingStatus.Pending,
            Address     = address,
            Notes       = notes?.Trim(),
        };
    }

    public void Confirm()
    {
        if (Status != BookingStatus.Pending)
            throw new BusinessRuleException("Seul un créneau en attente peut être confirmé.");
        Status = BookingStatus.Confirmed;
    }

    public void Cancel()
    {
        if (Status == BookingStatus.Completed)
            throw new BusinessRuleException("Un créneau complété ne peut pas être annulé.");
        Status = BookingStatus.Cancelled;
    }
}
```

---

## Application

### `Application/Common/Mediator/ICommand.cs` & `IQuery.cs`

```csharp
// Application/Common/Mediator/ICommand.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>Marqueur — commande qui retourne TResult.</summary>
public interface ICommand<TResult> { }

/// <summary>Marqueur — commande sans résultat significatif.</summary>
public interface ICommand : ICommand<Unit> { }

// Application/Common/Mediator/IQuery.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>Marqueur — query qui retourne TResult (lecture pure, pas de mutation).</summary>
public interface IQuery<TResult> { }
```

---

### `Application/Common/Mediator/ICommandHandler.cs` & `IQueryHandler.cs`

Les controllers passent par `IDispatcher.DispatchAsync(...)` et les handlers
implémentent `HandleAsync(...)` retournant `Task<TResult>`.

```csharp
// Application/Common/Mediator/ICommandHandler.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

public interface ICommandHandler<TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken ct);
}

public interface ICommandHandler<TCommand> : ICommandHandler<TCommand, Unit>
    where TCommand : ICommand { }

// Application/Common/Mediator/IQueryHandler.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

public interface IQueryHandler<TQuery, TResult>
    where TQuery : IQuery<TResult>
{
    Task<TResult> HandleAsync(TQuery query, CancellationToken ct);
}
```

---

### `Application/Common/Mediator/IDispatcher.cs` & `Dispatcher.cs`

```csharp
// Application/Common/Mediator/IDispatcher.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>Dispatcher CQRS maison — injecté dans les controllers.</summary>
public interface IDispatcher
{
    Task<TResult> DispatchAsync<TResult>(ICommand<TResult> command, CancellationToken cancellationToken = default);
    Task<TResult> DispatchAsync<TResult>(IQuery<TResult> query, CancellationToken cancellationToken = default);
}

// Application/Common/Mediator/Dispatcher.cs
namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>
/// Dispatcher Mediator maison — résolution via IServiceProvider.
/// Pas de dépendance sur MediatR. Scrutor enregistre automatiquement
/// tous les handlers dans Infrastructure/DependencyInjection.cs.
/// </summary>
public sealed class Dispatcher(IServiceProvider sp) : IDispatcher
{
    public Task<TResult> DispatchAsync<TResult>(
        ICommand<TResult> command, CancellationToken cancellationToken = default)
    {
        var handlerType = typeof(ICommandHandler<,>)
            .MakeGenericType(command.GetType(), typeof(TResult));

        dynamic handler = sp.GetRequiredService(handlerType);
        return handler.HandleAsync((dynamic)command, cancellationToken);
    }

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

### `Application/Common/Interfaces/IApplicationDbContext.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Abstraction du DbContext applicatif — injectée directement dans les handlers.
/// Pas de Repository Pattern générique : DbContext + LINQ suffisent.
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

---

### `Application/Products/Commands/CreateProduct/CreateProductCommand.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands.CreateProduct;

// sealed record = DTO immutable avec value equality
public sealed record CreateProductCommand(
    string   Name,
    string   Slug,
    decimal  Price,
    int      Stock,
    Guid     CategoryId,
    string?  Description = null,
    decimal? RentalPrice = null) : ICommand<Guid>;
```

---

### `Application/Products/Commands/CreateProduct/CreateProductCommandHandler.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands.CreateProduct;

internal sealed class CreateProductCommandHandler(
    IApplicationDbContext db,
    IDateTimeProvider     clock) : ICommandHandler<CreateProductCommand, Guid>
{
    public async Task<Guid> HandleAsync(CreateProductCommand cmd, CancellationToken ct)
    {
        // Unicité du slug
        var slugExists = await db.Products
            .AnyAsync(p => p.Slug == cmd.Slug, ct);

        if (slugExists)
            throw new ConflictException($"Un produit avec le slug « {cmd.Slug} » existe déjà.");

        var product = Product.Create(
            cmd.Name, cmd.Slug, cmd.Price, cmd.Stock,
            cmd.CategoryId, cmd.Description, cmd.RentalPrice);

        db.Products.Add(product);
        await db.SaveChangesAsync(ct);

        return product.Id;
    }
}
```

---

### `Application/Products/Commands/CreateProduct/CreateProductCommandValidator.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands.CreateProduct;

public sealed class CreateProductCommandValidator
    : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Le nom est requis.")
            .MaximumLength(200);

        RuleFor(x => x.Slug)
            .NotEmpty()
            .MaximumLength(200)
            .Matches(@"^[a-z0-9-]+$")
            .WithMessage("Le slug ne peut contenir que des minuscules, chiffres et tirets.");

        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Le prix doit être supérieur à zéro.");

        RuleFor(x => x.Stock)
            .GreaterThanOrEqualTo(0).WithMessage("Le stock ne peut pas être négatif.");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("La catégorie est requise.");

        When(x => x.RentalPrice.HasValue, () =>
        {
            RuleFor(x => x.RentalPrice!.Value)
                .GreaterThan(0).WithMessage("Le prix de location doit être positif.");
        });
    }
}
```

---

### `Application/Products/Queries/GetProductBySlug/ProductDto.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;

// sealed record — DTO immuable, serialisé en JSON
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
```

---

### `Application/Products/Queries/GetProductBySlug/GetProductBySlugQueryHandler.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;

internal sealed class GetProductBySlugQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetProductBySlugQuery, ProductDto>
{
    public async Task<ProductDto> HandleAsync(
        GetProductBySlugQuery query, CancellationToken ct)
    {
        // AsNoTracking() obligatoire sur les queries read-only
        var dto = await db.Products
            .AsNoTracking()
            .Where(p => p.Slug == query.Slug)
            .Select(p => new ProductDto(
                p.Id,
                p.Name,
                p.Slug,
                p.Description,
                p.Price,
                p.RentalPrice,
                p.Stock,
                p.IsAvailable,
                p.Category.Name,
                p.Images.Select(i => i.Url).ToList()))
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(Product), query.Slug);

        return dto;
    }
}
```

---

### `Application/Bookings/Commands/CreateBooking/CreateBookingCommand.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

public sealed record CreateBookingCommand(
    DateTime    SlotStart,
    int         DurationMin,
    BookingType Type,
    string      Street,
    string      City,
    string      Province,
    string      PostalCode,
    Guid?       OrderId = null,
    string?     Notes   = null) : ICommand<Guid>;
```

---

### `Application/Bookings/Commands/CreateBooking/CreateBookingCommandHandler.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;

internal sealed class CreateBookingCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService   currentUser,
    IEmailService         email) : ICommandHandler<CreateBookingCommand, Guid>
{
    public async Task<Guid> HandleAsync(CreateBookingCommand cmd, CancellationToken ct)
    {
        // Vérifier qu'il n'y a pas de collision de créneau
        var slotEnd = cmd.SlotStart.AddMinutes(cmd.DurationMin);
        var conflict = await db.BookingSlots
            .AnyAsync(b =>
                b.Status != BookingStatus.Cancelled &&
                b.SlotStart < slotEnd &&
                b.SlotStart.AddMinutes(b.DurationMin) > cmd.SlotStart, ct);

        if (conflict)
            throw new ConflictException("Ce créneau est déjà réservé. Veuillez en choisir un autre.");

        var address = Address.Create(cmd.Street, cmd.City, cmd.Province, cmd.PostalCode);
        var booking = BookingSlot.Create(
            currentUser.UserId, cmd.SlotStart, cmd.DurationMin,
            cmd.Type, address, cmd.OrderId, cmd.Notes);

        db.BookingSlots.Add(booking);
        await db.SaveChangesAsync(ct);

        // Notification email asynchrone (fire-and-forget acceptable ici)
        await email.SendBookingConfirmationAsync(booking.Id, currentUser.Email!, ct);

        return booking.Id;
    }
}
```

---

## Infrastructure

### `Infrastructure/Persistence/Interceptors/SoftDeleteInterceptor.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Intercepte les suppressions EF Core et les convertit en soft delete.
/// Suit la recommandation codewithmukesh 2026 (SaveChangesInterceptor).
/// </summary>
public sealed class SoftDeleteInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData       eventData,
        InterceptionResult<int>  result,
        CancellationToken        ct = default)
    {
        if (eventData.Context is null) return base.SavingChangesAsync(eventData, result, ct);

        var entries = eventData.Context.ChangeTracker
            .Entries<ISoftDeletable>()
            .Where(e => e.State == EntityState.Deleted);

        foreach (var entry in entries)
        {
            entry.State          = EntityState.Modified;
            entry.Entity.IsDeleted = true;
            entry.Entity.DeletedAt = DateTime.UtcNow;
        }

        return base.SavingChangesAsync(eventData, result, ct);
    }
}
```

---

### `Infrastructure/Persistence/ApplicationDbContext.cs`

DbContext UNIQUE : hérite de `IdentityDbContext<...>` (tables Identity) ET expose
les `DbSet<>` métier. Il n'existe pas de second `AppIdentityDbContext`.

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// DbContext UNIQUE — gère Identity ET les entités métier dans la même DB.
/// Les 5 types génériques Guid évitent que EF crée des PK string.
/// </summary>
public sealed class ApplicationDbContext(
    DbContextOptions<ApplicationDbContext> options,
    SoftDeleteInterceptor softDelete,
    AuditInterceptor      audit)
    : IdentityDbContext<
        AppUser,
        AppRole,
        Guid,
        IdentityUserClaim<Guid>,
        IdentityUserRole<Guid>,
        IdentityUserLogin<Guid>,
        IdentityRoleClaim<Guid>,
        IdentityUserToken<Guid>>(options),
      IApplicationDbContext
{
    public DbSet<Product>         Products          => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Order>           Orders            => Set<Order>();
    public DbSet<OrderLine>       OrderLines        => Set<OrderLine>();
    public DbSet<RentalContract>  RentalContracts   => Set<RentalContract>();
    public DbSet<BookingSlot>     BookingSlots      => Set<BookingSlot>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        => optionsBuilder
            .AddInterceptors(softDelete, audit);

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);  // Configure les 7 tables Identity — OBLIGATOIRE en premier
        // Applique toutes les IEntityTypeConfiguration<T> du même assembly
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

---

### `Infrastructure/Persistence/Configurations/ProductConfiguration.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(p => p.Slug)
            .HasMaxLength(200)
            .IsRequired();

        builder.HasIndex(p => p.Slug)
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");  // Index filtré — les slugs supprimés peuvent être réutilisés

        builder.Property(p => p.Price)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(p => p.RentalPrice)
            .HasColumnType("decimal(18,2)");

        builder.Property(p => p.Description)
            .HasMaxLength(2000);

        // Soft delete — query filter global
        builder.HasQueryFilter(p => !p.IsDeleted);

        // Index sur CategoryId (FK souvent filtrée)
        builder.HasIndex(p => p.CategoryId);

        // Owned collection d'images (table séparée)
        builder.OwnsMany(p => p.Images, img =>
        {
            img.WithOwner().HasForeignKey("ProductId");
            img.Property(i => i.Url).HasMaxLength(500).IsRequired();
            img.Property(i => i.AltText).HasMaxLength(200);
        });

        // Données de référence — catégories seedées ici, pas dans une migration
        builder.HasData(/* seed si nécessaire */);
    }
}
```

---

### `Infrastructure/Identity/TokenService.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

public sealed class TokenService(IConfiguration config)
{
    public string GenerateToken(AppUser user, IList<string> roles)
    {
        var key         = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email,          user.Email!),
            new("firstName",               user.FirstName),
            new("lastName",                user.LastName),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var token = new JwtSecurityToken(
            issuer:             config["Jwt:Issuer"],
            audience:           config["Jwt:Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(24),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
```

---

### `Infrastructure/Services/CurrentUserService.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services;

public sealed class CurrentUserService(IHttpContextAccessor accessor)
    : ICurrentUserService
{
    private ClaimsPrincipal? User => accessor.HttpContext?.User;

    public Guid    UserId  => Guid.Parse(User?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException());

    public string  Email   => User?.FindFirstValue(ClaimTypes.Email)
        ?? throw new UnauthorizedAccessException();

    public IReadOnlyList<string> Roles => User?
        .FindAll(ClaimTypes.Role)
        .Select(c => c.Value)
        .ToList()
        .AsReadOnly()
        ?? [];

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated is true;

    public bool IsInRole(string role) =>
        User?.IsInRole(role) is true;
}
```

---

## API

### `API/Controllers/ProductsController.cs`

Les controllers injectent `IDispatcher` et appellent `await dispatcher.DispatchAsync(...)`.
Pas de policy d'authentification globale : les endpoints publics sont `[AllowAnonymous]`,
les protégés `[Authorize]` ou via policies `StaffOrAbove` / `AdminOnly`.

```csharp
namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class ProductsController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Récupère un produit par son slug.</summary>
    [HttpGet("{slug}")]
    [AllowAnonymous]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
    {
        var result = await dispatcher.DispatchAsync(new GetProductBySlugQuery(slug), ct);
        return Ok(result);
    }

    /// <summary>Liste paginée des produits.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<PaginatedList<ProductDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int    page       = 1,
        [FromQuery] int    pageSize   = 12,
        [FromQuery] string? category  = null,
        [FromQuery] string? search    = null,
        CancellationToken ct = default)
    {
        var result = await dispatcher.DispatchAsync(
            new GetAllProductsQuery(page, pageSize, category, search), ct);
        return Ok(result);
    }

    /// <summary>Crée un produit (Admin seulement).</summary>
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType<Guid>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create(
        [FromBody] CreateProductCommand cmd, CancellationToken ct)
    {
        // Zéro logique ici — tout va dans le handler via IDispatcher
        var id = await dispatcher.DispatchAsync(cmd, ct);
        return CreatedAtAction(nameof(GetBySlug),
            new { slug = cmd.Slug, version = "1.0" }, id);
    }
}
```

---

### `API/Middlewares/GlobalExceptionHandler.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.API.Middlewares;

/// <summary>
/// Mappe les exceptions Domain vers RFC 9457 ProblemDetails.
/// Enregistré via AddExceptionHandler&lt;T&gt; — pas de middleware personnalisé.
/// Zéro try/catch dans les controllers.
/// </summary>
internal sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext       httpContext,
        Exception         exception,
        CancellationToken ct)
    {
        var (statusCode, title) = exception switch
        {
            NotFoundException           => (404, "Ressource introuvable"),
            ConflictException           => (409, "Conflit de données"),
            ForbiddenException          => (403, "Accès refusé"),
            BusinessRuleException       => (422, "Règle métier violée"),
            ValidationException         => (422, "Données invalides"),
            UnauthorizedAccessException => (401, "Non authentifié"),
            _                           => (500, "Erreur interne du serveur"),
        };

        if (statusCode == 500)
            logger.LogError(exception, "Erreur non gérée : {Message}", exception.Message);

        var detail = exception is ValidationException ve
            ? string.Join(" | ", ve.Errors.Select(e => e.ErrorMessage))
            : exception.Message;

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status     = statusCode,
            Title      = title,
            Detail     = detail,
            Extensions = { ["traceId"] = httpContext.TraceIdentifier },
        }, ct);

        return true;
    }
}
```

---

### `API/Program.cs` (extrait)

`Program.cs` n'enregistre que `IDispatcher`. L'auto-enregistrement des handlers (Scrutor)
ET `AddValidatorsFromAssembly` se font dans `AddInfrastructure(...)`
(`Infrastructure/DependencyInjection.cs`) — pas ici.

```csharp
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Infrastructure;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.API.Middlewares;
using Asp.Versioning;

var builder = WebApplication.CreateBuilder(args);

// ── Infrastructure (EF Core, Identity, JWT, services, handlers, validateurs) ──
// AddInfrastructure fait aussi le Scan Scrutor des handlers + AddValidatorsFromAssembly.
builder.Services.AddInfrastructure(builder.Configuration);

// ── Mediator Dispatcher ───────────────────────────────────────────────────────
builder.Services.AddScoped<IDispatcher, Dispatcher>();

// ── Contrôleurs ──────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddApiVersioning(opt =>
{
    opt.DefaultApiVersion = new ApiVersion(1, 0);
    opt.AssumeDefaultVersionWhenUnspecified = true;
    opt.ReportApiVersions = true;
});

// ── Exception handler (RFC 9457) ──────────────────────────────────────────────
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opt => opt.AddPolicy("Frontend", policy =>
    policy.WithOrigins(builder.Configuration["AllowedOrigins"]!.Split(','))
          .AllowAnyHeader()
          .AllowAnyMethod()));

// ── OpenAPI / Scalar ─────────────────────────────────────────────────────────
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Seeder (rôles + compte admin) ─────────────────────────────────────────────
await IdentitySeeder.SeedAsync(app.Services);

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

await app.RunAsync();
```

---

## Tests

### `AbrisAutoOutaouais-WebApp.UnitTest/Domain/ProductTests.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

public sealed class ProductTests
{
    [Fact]
    public void Create_WithValidData_ReturnsProduct()
    {
        var product = Product.Create("Abri Simple", "abri-simple", 299.99m, 10, Guid.NewGuid());

        product.Name.Should().Be("Abri Simple");
        product.Slug.Should().Be("abri-simple");
        product.IsAvailable.Should().BeTrue();
        product.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_WithNegativePrice_Throws()
    {
        var act = () => Product.Create("Abri", "abri", -1m, 5, Guid.NewGuid());
        act.Should().Throw<ArgumentException>().WithMessage("*prix*");
    }

    [Fact]
    public void AdjustStock_BelowZero_Throws()
    {
        var product = Product.Create("Abri", "abri", 100m, 2, Guid.NewGuid());
        var act     = () => product.AdjustStock(-5);
        act.Should().Throw<BusinessRuleException>().WithMessage("*stock*");
    }

    [Fact]
    public void AdjustStock_ToZero_SetsUnavailable()
    {
        var product = Product.Create("Abri", "abri", 100m, 1, Guid.NewGuid());
        product.AdjustStock(-1);
        product.IsAvailable.Should().BeFalse();
        product.Stock.Should().Be(0);
    }
}
```
