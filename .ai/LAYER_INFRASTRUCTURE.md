# LAYER_INFRASTRUCTURE.md — Couche Infrastructure

Implémente les interfaces définies dans Application.
Contient EF Core, Identity, JWT, services externes.
**Jamais référencée directement par Application ou Domain.**

---

## Règle d'or

Infrastructure dépend de Domain et d'Application (pour implémenter leurs interfaces).
Domain et Application ne dépendent JAMAIS d'Infrastructure.

---

## Arborescence complète

```
src/AbrisAutoOutaouais-WebApp.Infrastructure/
├── AbrisAutoOutaouais-WebApp.Infrastructure.csproj
├── DependencyInjection.cs          ← registration complète de tous les services
│
├── Identity/                       ← AppUser ET AppRole vivent ICI
│   ├── AppUser.cs                  ← : IdentityUser<Guid> avec tous les champs profil
│   ├── AppRole.cs                  ← : IdentityRole<Guid>
│   ├── TokenService.cs             ← génération JWT
│   ├── IdentityService.cs          ← implémente IIdentityService
│   ├── IdentitySeeder.cs           ← crée rôles + compte admin au démarrage
│   └── Configurations/
│       └── AppUserConfiguration.cs ← IEntityTypeConfiguration<AppUser>
│
├── Persistence/
│   ├── ApplicationDbContext.cs     ← UNIQUE DbContext : IdentityDbContext<AppUser,AppRole,Guid,…>
│   ├── DesignTimeDbContextFactory.cs ← pour dotnet ef migrations en CLI
│   ├── Interceptors/
│   │   ├── SoftDeleteInterceptor.cs   ← convertit Delete → IsDeleted=true
│   │   └── AuditInterceptor.cs        ← remplit CreatedAt/UpdatedAt/CreatedBy/UpdatedBy
│   ├── Configurations/             ← IEntityTypeConfiguration<T> par entité
│   │   ├── ProductConfiguration.cs
│   │   ├── ProductCategoryConfiguration.cs
│   │   ├── OrderConfiguration.cs
│   │   ├── OrderLineConfiguration.cs
│   │   ├── RentalContractConfiguration.cs
│   │   └── BookingSlotConfiguration.cs
│   └── Migrations/                 ← générés par EF Core (InitialMigration, Fix_01_LaunchAPI)
│
└── Services/
    ├── CurrentUserService.cs       ← implémente ICurrentUserService (claims HTTP)
    ├── DateTimeProvider.cs         ← implémente IDateTimeProvider
    ├── EmailService.cs             ← implémente IEmailService (SendGrid ou SMTP)
    └── LocalFileStorageService.cs  ← implémente IFileStorageService (wwwroot/uploads)
```

---

## AbrisAutoOutaouais-WebApp.Infrastructure.csproj

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <RootNamespace>AbrisAutoOutaouais_WebApp.Infrastructure</RootNamespace>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <!-- Infrastructure ne référence QUE Application — Domain vient transitivement -->
    <ProjectReference Include="..\AbrisAutoOutaouais-WebApp.Application\AbrisAutoOutaouais-WebApp.Application.csproj" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="FluentValidation"                                  Version="12.1.1" />
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions"    Version="12.*" />
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="10.0.8" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer"           Version="10.0.8" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools"               Version="10.0.8" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design"              Version="10.0.8" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer"     Version="10.0.8" />
    <PackageReference Include="Scrutor.AspNetCore"                                Version="3.3.0" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt"                   Version="8.0.1" />
  </ItemGroup>
</Project>
```

---

## Identity/

### `Identity/AppUser.cs`

```csharp
using Domain.ValueObjects;
using Microsoft.AspNetCore.Identity;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Utilisateur de l'application.
/// Étend IdentityUser&lt;Guid&gt; directement — ZÉRO table UserProfile/Customer séparée.
///
/// IdentityUser&lt;Guid&gt; fournit déjà :
///   Id, Email, NormalizedEmail, EmailConfirmed,
///   UserName, NormalizedUserName, PasswordHash,
///   PhoneNumber, PhoneNumberConfirmed,
///   SecurityStamp, ConcurrencyStamp,
///   TwoFactorEnabled, LockoutEnabled, LockoutEnd, AccessFailedCount.
///
/// Address vient de Domain.ValueObjects — Infrastructure peut référencer Domain ✅.
/// </summary>
public sealed class AppUser : IdentityUser<Guid>
{
    public string   FirstName          { get; set; } = string.Empty;
    public string   LastName           { get; set; } = string.Empty;
    public string?  Avatar             { get; set; }
    public string   PreferredLanguage  { get; set; } = "fr";

    /// <summary>
    /// Adresse de livraison par défaut sauvegardée par l'utilisateur.
    /// Owned Entity — colonnes préfixées "DefaultAddress_*" dans AspNetUsers.
    /// Utilisée pour pré-remplir le formulaire de commande.
    /// </summary>
    public Address? DefaultDeliveryAddress { get; set; }

    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}
```

### `Identity/AppRole.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>Rôle étendu avec Guid comme PK (cohérence avec AppUser).</summary>
public sealed class AppRole : IdentityRole<Guid>
{
    public AppRole() { }
    public AppRole(string roleName) : base(roleName) { }

    public string? Description { get; set; }
}
```

### `Identity/Configurations/AppUserConfiguration.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity.Configurations;

/// <summary>
/// Configure les colonnes supplémentaires de AppUser dans AspNetUsers.
/// base.OnModelCreating() dans ApplicationDbContext configure déjà les colonnes Identity standard.
/// </summary>
internal sealed class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.Property(u => u.FirstName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.LastName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.Avatar)
            .HasMaxLength(500);

        builder.Property(u => u.PreferredLanguage)
            .HasMaxLength(2)
            .IsRequired()
            .HasDefaultValue("fr");

        // Owned Entity — Address de Domain.ValueObjects
        // Stockée dans AspNetUsers avec colonnes préfixées "DefaultAddress_"
        builder.OwnsOne(u => u.DefaultDeliveryAddress, addr =>
        {
            addr.Property(a => a.Street)
                .HasColumnName("DefaultAddress_Street").HasMaxLength(200);
            addr.Property(a => a.City)
                .HasColumnName("DefaultAddress_City").HasMaxLength(100);
            addr.Property(a => a.Province)
                .HasColumnName("DefaultAddress_Province").HasMaxLength(2).HasDefaultValue("QC");
            addr.Property(a => a.PostalCode)
                .HasColumnName("DefaultAddress_PostalCode").HasMaxLength(7);
            addr.Property(a => a.Country)
                .HasColumnName("DefaultAddress_Country").HasMaxLength(50).HasDefaultValue("Canada");
        });
    }
}
```

---

## Persistence/

### `Persistence/ApplicationDbContext.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// DbContext UNIQUE — gère Identity ET les entités métier dans la même DB.
///
/// Hérite de IdentityDbContext avec les 5 types génériques Guid pour éviter
/// que EF crée des tables avec PK string au lieu de Guid.
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
    // ── Entités métier ──────────────────────────────────────────────────────
    public DbSet<Product>         Products          => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Order>           Orders            => Set<Order>();
    public DbSet<OrderLine>       OrderLines        => Set<OrderLine>();
    public DbSet<RentalContract>  RentalContracts   => Set<RentalContract>();
    public DbSet<BookingSlot>     BookingSlots      => Set<BookingSlot>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        => optionsBuilder.AddInterceptors(softDelete, audit);

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);  // Configure les 7 tables Identity — OBLIGATOIRE
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

### `Persistence/DesignTimeDbContextFactory.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// Permet d'exécuter "dotnet ef migrations add" depuis le CLI
/// sans démarrer l'application complète.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseSqlServer(
            "Server=(localdb)\\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;");

        return new ApplicationDbContext(
            optionsBuilder.Options,
            new SoftDeleteInterceptor(),
            new AuditInterceptor(null!));  // null acceptable en design-time
    }
}
```

---

## Persistence/Interceptors/

### `SoftDeleteInterceptor.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Intercepte les suppressions EF Core sur les entités ISoftDeletable.
/// Remplace EntityState.Deleted par IsDeleted=true + DeletedAt=UtcNow.
/// Le named query filter HasQueryFilter(e => !e.IsDeleted) exclut automatiquement
/// les entités supprimées de TOUTES les queries.
/// Pour voir les supprimés (admin) : .IgnoreQueryFilters().
/// </summary>
public sealed class SoftDeleteInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData      eventData,
        InterceptionResult<int> result,
        CancellationToken       ct = default)
    {
        if (eventData.Context is null)
            return base.SavingChangesAsync(eventData, result, ct);

        var entries = eventData.Context.ChangeTracker
            .Entries<ISoftDeletable>()
            .Where(e => e.State == EntityState.Deleted);

        foreach (var entry in entries)
        {
            entry.State            = EntityState.Modified;
            entry.Entity.IsDeleted = true;
            entry.Entity.DeletedAt = DateTime.UtcNow;
        }

        return base.SavingChangesAsync(eventData, result, ct);
    }
}
```

### `AuditInterceptor.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Interceptors;

public sealed class AuditInterceptor(ICurrentUserService? currentUser)
    : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData      eventData,
        InterceptionResult<int> result,
        CancellationToken       ct = default)
    {
        if (eventData.Context is null)
            return base.SavingChangesAsync(eventData, result, ct);

        var now   = DateTime.UtcNow;
        var actor = currentUser?.IsAuthenticated is true ? currentUser.Email : "system";

        foreach (var entry in eventData.Context.ChangeTracker.Entries<IAuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy = actor;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = actor;
                    break;
            }
        }

        return base.SavingChangesAsync(eventData, result, ct);
    }
}
```

---

## Persistence/Configurations/

Toutes les configurations EF Core des entités métier. Pattern identique.

### `OrderConfiguration.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);

        builder.Property(o => o.TotalAmount)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(o => o.Status)
            .HasConversion<string>()   // stocké comme string lisible en DB
            .HasMaxLength(20);

        builder.Property(o => o.DeliveryType)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(o => o.Notes)
            .HasMaxLength(500);

        // Owned Entity — snapshot de l'adresse au moment de la commande
        // Colonnes : ShippingAddress_Street, ShippingAddress_City, etc.
        builder.OwnsOne(o => o.ShippingAddress, addr =>
        {
            addr.Property(a => a.Street)
                .HasColumnName("ShippingAddress_Street").HasMaxLength(200);
            addr.Property(a => a.City)
                .HasColumnName("ShippingAddress_City").HasMaxLength(100);
            addr.Property(a => a.Province)
                .HasColumnName("ShippingAddress_Province").HasMaxLength(2);
            addr.Property(a => a.PostalCode)
                .HasColumnName("ShippingAddress_PostalCode").HasMaxLength(7);
            addr.Property(a => a.Country)
                .HasColumnName("ShippingAddress_Country").HasMaxLength(50);
        });

        // FK réelle vers AspNetUsers — possible grâce au DbContext unique
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);  // pas de cascade delete sur commandes

        // Soft delete — query filter global
        builder.HasQueryFilter(o => !o.IsDeleted);

        // Relations avec OrderLines
        builder.HasMany(o => o.Lines)
            .WithOne()
            .HasForeignKey(l => l.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

### `ProductConfiguration.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Slug).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(2000);
        builder.Property(p => p.Price).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(p => p.RentalPrice).HasColumnType("decimal(18,2)");

        // Index unique filtré — les slugs soft-deleted peuvent être réutilisés
        builder.HasIndex(p => p.Slug)
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");

        builder.HasQueryFilter(p => !p.IsDeleted);

        // Owned collection d'images
        builder.OwnsMany(p => p.Images, img =>
        {
            img.WithOwner().HasForeignKey("ProductId");
            img.Property(i => i.Url).HasMaxLength(500).IsRequired();
            img.Property(i => i.AltText).HasMaxLength(200);
        });

        builder.HasOne(p => p.Category)
            .WithMany()
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
```

### `BookingSlotConfiguration.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

internal sealed class BookingSlotConfiguration : IEntityTypeConfiguration<BookingSlot>
{
    public void Configure(EntityTypeBuilder<BookingSlot> builder)
    {
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(b => b.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(b => b.Notes).HasMaxLength(500);

        builder.OwnsOne(b => b.Address, addr =>
        {
            addr.Property(a => a.Street).HasColumnName("Address_Street").HasMaxLength(200);
            addr.Property(a => a.City).HasColumnName("Address_City").HasMaxLength(100);
            addr.Property(a => a.Province).HasColumnName("Address_Province").HasMaxLength(2);
            addr.Property(a => a.PostalCode).HasColumnName("Address_PostalCode").HasMaxLength(7);
            addr.Property(a => a.Country).HasColumnName("Address_Country").HasMaxLength(50);
        });

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(b => b.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Index pour vérifier les conflits de créneaux efficacement
        builder.HasIndex(b => new { b.SlotStart, b.Status });

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}
```

---

## Services/

### `Services/CurrentUserService.cs`

Voir **IDENTITY.md** section 10 pour le code complet.

### `Services/DateTimeProvider.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services;

internal sealed class DateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
```

### `Services/LocalFileStorageService.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services;

internal sealed class LocalFileStorageService(
    IWebHostEnvironment env,
    IHttpContextAccessor accessor) : IFileStorageService
{
    private static readonly string[] AllowedTypes = ["image/jpeg", "image/png", "image/webp"];
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB

    public async Task<string> SaveAsync(
        Stream fileStream, string fileName, string contentType,
        CancellationToken ct = default)
    {
        if (!AllowedTypes.Contains(contentType))
            throw new BusinessRuleException("Type de fichier non supporté (jpg, png, webp uniquement).");
        if (fileStream.Length > MaxBytes)
            throw new BusinessRuleException("Fichier trop volumineux (max 5 Mo).");

        var uploadsPath = Path.Combine(env.WebRootPath, "uploads", "products");
        Directory.CreateDirectory(uploadsPath);

        var ext      = Path.GetExtension(fileName);
        var unique   = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(uploadsPath, unique);

        await using var fs = new FileStream(fullPath, FileMode.Create);
        await fileStream.CopyToAsync(fs, ct);

        var request  = accessor.HttpContext!.Request;
        return $"{request.Scheme}://{request.Host}/uploads/products/{unique}";
    }

    public Task DeleteAsync(string fileUrl, CancellationToken ct = default)
    {
        var fileName = Path.GetFileName(new Uri(fileUrl).LocalPath);
        var path     = Path.Combine(env.WebRootPath, "uploads", "products", fileName);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }
}
```

---

## DependencyInjection.cs

```csharp
namespace AbrisAutoOutaouais_WebApp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        // ── DbContext unique (Identity + domaine) ─────────────────────────────
        services.AddDbContext<ApplicationDbContext>(opts =>
            opts.UseSqlServer(config.GetConnectionString("DefaultConnection")!,
                sql => sql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

        services.AddScoped<IApplicationDbContext>(
            sp => sp.GetRequiredService<ApplicationDbContext>());

        // ── Interceptors ──────────────────────────────────────────────────────
        services.AddSingleton<SoftDeleteInterceptor>();  // sans état mutable
        services.AddScoped<AuditInterceptor>();   // Scoped car dépend de ICurrentUserService

        // ── ASP.NET Core Identity ─────────────────────────────────────────────
        services
            .AddIdentity<AppUser, AppRole>(opts =>
            {
                opts.Password.RequiredLength         = 8;
                opts.Password.RequireDigit           = true;
                opts.Password.RequireLowercase       = true;
                opts.Password.RequireUppercase       = true;
                opts.Password.RequireNonAlphanumeric = true;
                opts.User.RequireUniqueEmail         = true;
                opts.Lockout.MaxFailedAccessAttempts = 5;
                opts.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(10);
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        // ── JWT Bearer ────────────────────────────────────────────────────────
        var jwtKey = config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key requis.");

        services
            .AddAuthentication(opts =>
            {
                opts.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                opts.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(opts =>
            {
                opts.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey         = new SymmetricSecurityKey(
                                                  Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuer   = true,  ValidIssuer   = config["Jwt:Issuer"],
                    ValidateAudience = true,  ValidAudience = config["Jwt:Audience"],
                    ValidateLifetime = true,
                    ClockSkew        = TimeSpan.Zero,
                };
                opts.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = ctx =>
                    {
                        if (ctx.Exception is SecurityTokenExpiredException)
                            ctx.Response.Headers.Append("Token-Expired", "true");
                        return Task.CompletedTask;
                    },
                };
            });

        // ── Authorization policies ────────────────────────────────────────────
        services.AddAuthorizationBuilder()
            .AddPolicy("StaffOrAbove", p => p.RequireRole(Roles.Staff, Roles.Admin))
            .AddPolicy("AdminOnly",    p => p.RequireRole(Roles.Admin));

        // ── Services Identity ─────────────────────────────────────────────────
        services.AddScoped<TokenService>();
        services.AddScoped<IIdentityService, IdentityService>();

        // ── Services métier ───────────────────────────────────────────────────
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<IFileStorageService, LocalFileStorageService>();
        services.AddScoped<IEmailService, EmailService>();

        // ── Auto-enregistrement des handlers CQRS via Scrutor ─────────────────
        services.Scan(scan => scan
            .FromAssemblies(typeof(AssemblyMarker).Assembly)
            .AddClasses(c => c.AssignableTo(typeof(ICommandHandler<,>)))
                .AsImplementedInterfaces().WithScopedLifetime()
            .AddClasses(c => c.AssignableTo(typeof(IQueryHandler<,>)))
                .AsImplementedInterfaces().WithScopedLifetime());

        // ── FluentValidation ──────────────────────────────────────────────────
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        return services;
    }
}
```

---

## Récapitulatif — ce qui appartient (et n'appartient PAS) à Infrastructure

| ✅ Appartient à Infrastructure | ❌ N'appartient PAS à Infrastructure |
|-------------------------------|--------------------------------------|
| AppUser, AppRole | Entités Domain (Product, Order…) |
| ApplicationDbContext | IApplicationDbContext (dans Application) |
| IEntityTypeConfiguration\<T\> | Controllers |
| TokenService, IdentityService | Dispatcher Mediator |
| Interceptors EF Core | FluentValidation validators |
| CurrentUserService | Result\<T\>, PaginatedList |
| EmailService, FileStorageService | DTOs Application |
| DependencyInjection.cs | Program.cs |
