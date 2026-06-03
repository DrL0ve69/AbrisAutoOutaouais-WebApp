# IDENTITY.md — AbrisTempo Local

Guide complet et autonome sur l'authentification / autorisation.
Corrige et remplace les mentions à deux DbContext des docs précédents.

---

## Table des matières

1. [Philosophie — pas de table dupliquée](#1-philosophie)
2. [Où vit `AppUser` ?](#2-où-vit-appuser)
3. [Packages NuGet requis](#3-packages-nuget-requis)
4. [AppUser et AppRole](#4-appuser-et-approle)
5. [DbContext unique](#5-dbcontext-unique)
6. [Configuration EF Core de AppUser](#6-configuration-ef-core-de-appuser)
7. [Interfaces Application](#7-interfaces-application)
8. [TokenService](#8-tokenservice)
9. [IdentityService](#9-identityservice)
10. [CurrentUserService](#10-currentuserservice)
11. [Commands et Handlers (Application)](#11-commands-et-handlers)
12. [AuthController](#12-authcontroller)
13. [Seeder](#13-seeder)
14. [DI Registration](#14-di-registration)
15. [Program.cs — Identity + JWT](#15-programcs)
16. [appsettings.json](#16-appsettingsjson)
17. [Commandes EF Core](#17-commandes-ef-core)
18. [Schéma final des tables](#18-schéma-final-des-tables)

---

## 1. Philosophie

### Le problème du doublement de table

L'anti-pattern à éviter absolument :

```
AspNetUsers          UserProfiles (ou Customers)
───────────          ──────────────────────────
Id                   Id
Email                UserId  ← FK vers AspNetUsers
PasswordHash         FirstName
...                  LastName
                     Phone
                     Address
                     Avatar
```

Deux tables, deux migrations à synchroniser, deux points de vérité, jointures obligatoires partout.
**Aucune valeur ajoutée.**

### La solution — tout sur AppUser

```
AspNetUsers (= AppUser étendu)
─────────────────────────────────────────────
Id (Guid)
Email / UserName / PasswordHash / ...  ← fournis par IdentityUser<Guid>
FirstName                              ← ajouté
LastName                               ← ajouté
Avatar                                 ← ajouté
PhoneNumber                            ← déjà sur IdentityUser !
PreferredLanguage                      ← ajouté
CreatedAt / UpdatedAt                  ← ajouté
DeliveryAddress_Street                 ← Owned Entity (colonnes préfixées)
DeliveryAddress_City
DeliveryAddress_Province
DeliveryAddress_PostalCode
```

Un seul `AspNetUsers`, zéro jointure pour récupérer le profil complet.

### Correction du doc précédent

`CODE_EXAMPLES_BACKEND.md` et `ARBORESCENCE.md` mentionnaient **deux DbContext séparés**
(`AppIdentityDbContext` + `ApplicationDbContext`).

**Ce doc remplace cette approche par un seul DbContext** :
`ApplicationDbContext : IdentityDbContext<AppUser, AppRole, Guid>`

Avantages :
- FK réelle d'EF Core entre `Orders.CustomerId → AspNetUsers.Id` (au lieu de Guid "orphelin").
- Une seule commande de migration.
- Un seul pipeline de test d'intégration.
- Plus simple pour un projet solo / portfolio.

L'entité `Customer.cs` mentionnée dans les docs précédents est **supprimée**.
`AppUser` *est* le client. Les entités métier (`Order`, `BookingSlot`, `RentalContract`)
ont une FK vers `AppUser.Id` via une navigation EF standard.

---

## 2. Où vit `AppUser` ?

```
src/
├── Domain/              ← JAMAIS ici — IdentityUser vient d'ASP.NET Core (infra)
│   ├── Constants/
│   │   └── Roles.cs
│   ├── Entities/
│   │   ├── Product.cs
│   │   ├── ProductCategory.cs
│   │   ├── Order.cs
│   │   ├── OrderLine.cs
│   │   ├── RentalContract.cs
│   │   ├── BookingSlot.cs
│   │   └── Customer.cs
│   ├── ValueObjects/
│   │   ├── Address.cs
│   │   ├── Money.cs
│   │   └── PhoneNumber.cs
│   ├── Enums/
│   │   ├── OrderStatus.cs
│   │   ├── RentalStatus.cs
│   │   ├── BookingStatus.cs
│   │   ├── DeliveryType.cs
│   │   └── ProductCategory.cs
│   ├── Exceptions/
│   │   ├── NotFoundException.cs
│   │   ├── ForbiddenException.cs
│   │   ├── ConflictException.cs
│   │   └── BusinessRuleException.cs
│   ├── Interfaces/
│   │   ├── ISoftDeletable.cs
│   │   └── IAuditableEntity.cs
├── Application/         ← JAMAIS ici — couche métier ne dépend pas d'Identity
├── Infrastructure/
│   └── Identity/
│       ├── AppUser.cs          ✅ ICI
│       ├── AppRole.cs          ✅ ICI
│       ├── TokenService.cs     ✅ ICI
│       ├── IdentityService.cs  ✅ ICI
│       └── Migrations/         ✅ ICI (une seule migration pour tout)
└── Api/
```

**Pourquoi Infrastructure ?**
`AppUser` hérite de `IdentityUser<Guid>` qui est une classe ASP.NET Core Identity,
donc une dépendance d'infrastructure. Placer `AppUser` dans Domain ou Application
violerait la règle d'or (couches internes sans dépendances externes).

Application communique avec Identity uniquement via :
- `IIdentityService` — interface définie dans Application.
- `ICurrentUserService` — interface définie dans Application.

---

## 3. Packages NuGet requis

```xml
<!-- src/Infrastructure/Infrastructure.csproj -->
<PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="10.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer"           Version="10.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools"               Version="10.*" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer"     Version="10.*" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt"                   Version="8.*"  />
<PackageReference Include="Scrutor"                                            Version="5.*"  />

<!-- src/Api/Api.csproj -->
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.*" />
```

---

## 4. AppUser et AppRole

### `Infrastructure/Identity/AppUser.cs`

```csharp
namespace Infrastructure.Identity;

/// <summary>
/// Utilisateur de l'application — étend IdentityUser&lt;Guid&gt; directement.
/// Toutes les données du profil vivent ici : zéro table UserProfile séparée.
///
/// IdentityUser&lt;Guid&gt; fournit déjà :
///   Id, Email, NormalizedEmail, EmailConfirmed,
///   UserName, NormalizedUserName, PasswordHash,
///   PhoneNumber, PhoneNumberConfirmed,
///   SecurityStamp, ConcurrencyStamp,
///   TwoFactorEnabled, LockoutEnabled, LockoutEnd, AccessFailedCount.
/// </summary>
public sealed class AppUser : IdentityUser<Guid>
{
    // ── Profil ───────────────────────────────────────────────────────────────
    public string  FirstName         { get; set; } = string.Empty;
    public string  LastName          { get; set; } = string.Empty;
    public string? Avatar            { get; set; }               // URL vers l'image stockée
    public string  PreferredLanguage { get; set; } = "fr";      // "fr" | "en"

    // ── Adresse de livraison par défaut (Owned Entity) ────────────────────
    // Stockée dans AspNetUsers avec le préfixe "DeliveryAddress_"
    // Null si l'utilisateur n'a pas encore fourni d'adresse
    public DeliveryAddress? DefaultDeliveryAddress { get; set; }

    // ── Audit ────────────────────────────────────────────────────────────────
    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // ── Navigations (non-FK — même DbContext, EF gère les relations) ─────────
    // Orders, RentalContracts, BookingSlots référencent AppUser.Id
    // On ne déclare pas les collections ici pour garder AppUser simple.
    // Utiliser .Include() dans les queries si besoin.

    // ── Helpers ──────────────────────────────────────────────────────────────
    public string FullName => $"{FirstName} {LastName}".Trim();
}
```

---

### `Infrastructure/Identity/DeliveryAddress.cs`

```csharp
namespace Infrastructure.Identity;

/// <summary>
/// Owned Entity — stockée dans AspNetUsers, pas dans une table séparée.
/// Configurée via AppUserConfiguration.
/// </summary>
public sealed class DeliveryAddress
{
    public string  Street     { get; set; } = string.Empty;
    public string  City       { get; set; } = string.Empty;
    public string  Province   { get; set; } = "QC";
    public string  PostalCode { get; set; } = string.Empty;
    public string  Country    { get; set; } = "Canada";
}
```

---

### `Infrastructure/Identity/AppRole.cs`

```csharp
namespace Infrastructure.Identity;

/// <summary>
/// Rôle étendu — Guid comme PK (cohérence avec AppUser).
/// Peut être enrichi (Description, etc.) sans impacter les migrations Identity.
/// </summary>
public sealed class AppRole : IdentityRole<Guid>
{
    public AppRole() { }
    public AppRole(string roleName) : base(roleName) { }

    public string? Description { get; set; }
}
```

---

## 5. DbContext unique

### `Infrastructure/Persistence/ApplicationDbContext.cs`

```csharp
namespace Infrastructure.Persistence;

/// <summary>
/// DbContext unique qui gère à la fois les tables Identity ET les entités métier.
///
/// Hérite de IdentityDbContext&lt;AppUser, AppRole, Guid, ...&gt; pour que
/// EF Core génère les 7 tables Identity (AspNetUsers, AspNetRoles,
/// AspNetUserRoles, AspNetUserClaims, AspNetUserLogins,
/// AspNetUserTokens, AspNetRoleClaims) avec Guid comme PK.
///
/// IApplicationDbContext est défini dans Application — aucune fuite vers Infrastructure.
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
    public DbSet<Product>        Products        => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Order>          Orders          => Set<Order>();
    public DbSet<OrderLine>      OrderLines      => Set<OrderLine>();
    public DbSet<RentalContract> RentalContracts => Set<RentalContract>();
    public DbSet<BookingSlot>    BookingSlots    => Set<BookingSlot>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        => optionsBuilder.AddInterceptors(softDelete, audit);

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Obligatoire — configure les 7 tables Identity
        base.OnModelCreating(builder);

        // Applique toutes les IEntityTypeConfiguration<T> du même assembly
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

---

## 6. Configuration EF Core de AppUser

### `Infrastructure/Identity/Configurations/AppUserConfiguration.cs`

```csharp
namespace Infrastructure.Identity.Configurations;

internal sealed class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        // La table s'appelle déjà "AspNetUsers" (défini par base.OnModelCreating)
        // On configure seulement nos colonnes supplémentaires.

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

        builder.Property(u => u.CreatedAt)
            .IsRequired();

        // Owned Entity — adresse de livraison par défaut
        // Colonnes : DeliveryAddress_Street, DeliveryAddress_City, etc.
        builder.OwnsOne(u => u.DefaultDeliveryAddress, address =>
        {
            address.Property(a => a.Street)
                .HasColumnName("DeliveryAddress_Street")
                .HasMaxLength(200);

            address.Property(a => a.City)
                .HasColumnName("DeliveryAddress_City")
                .HasMaxLength(100);

            address.Property(a => a.Province)
                .HasColumnName("DeliveryAddress_Province")
                .HasMaxLength(2)
                .HasDefaultValue("QC");

            address.Property(a => a.PostalCode)
                .HasColumnName("DeliveryAddress_PostalCode")
                .HasMaxLength(7);

            address.Property(a => a.Country)
                .HasColumnName("DeliveryAddress_Country")
                .HasMaxLength(50)
                .HasDefaultValue("Canada");
        });

        // Index sur Email normalisé (Identity l'ajoute, mais on le précise ici)
        builder.HasIndex(u => u.NormalizedEmail).IsUnique();
    }
}
```

### `Infrastructure/Persistence/Configurations/OrderConfiguration.cs` (extrait)

```csharp
internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);

        // FK réelle vers AspNetUsers — possible grâce au DbContext unique
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // ... reste de la configuration
    }
}
```

---

## 7. Interfaces Application

Ces interfaces permettent aux handlers CQRS d'interagir avec Identity
**sans jamais dépendre d'Infrastructure**.

### `Application/Common/Interfaces/IIdentityService.cs`

```csharp
namespace Application.Common.Interfaces;

/// <summary>
/// Abstraction des opérations Identity — implémentée dans Infrastructure.
/// Les handlers n'importent rien de Microsoft.AspNetCore.Identity.
/// </summary>
public interface IIdentityService
{
    /// <summary>Crée un compte et retourne le nouveau userId.</summary>
    Task<(Result Result, Guid UserId)> CreateUserAsync(
        string email,
        string firstName,
        string lastName,
        string password,
        CancellationToken ct = default);

    /// <summary>Valide les credentials et retourne l'AuthResponse si succès.</summary>
    Task<AuthResponse?> LoginAsync(
        string email,
        string password,
        CancellationToken ct = default);

    /// <summary>Récupère le profil complet d'un utilisateur.</summary>
    Task<UserProfileDto?> GetUserProfileAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Met à jour les champs du profil.</summary>
    Task<Result> UpdateProfileAsync(
        Guid userId,
        UpdateProfileRequest request,
        CancellationToken ct = default);

    /// <summary>Change le mot de passe.</summary>
    Task<Result> ChangePasswordAsync(
        Guid userId,
        string currentPassword,
        string newPassword,
        CancellationToken ct = default);

    /// <summary>Assigne un rôle (Admin seulement).</summary>
    Task<Result> AssignRoleAsync(Guid userId, string role, CancellationToken ct = default);

    /// <summary>Vérifie si un email existe déjà.</summary>
    Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);
}
```

---

### `Application/Common/Interfaces/ICurrentUserService.cs`

```csharp
namespace Application.Common.Interfaces;

/// <summary>
/// Fournit l'identité de l'utilisateur courant depuis le contexte HTTP.
/// Implémentée dans Infrastructure via IHttpContextAccessor.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>Id de l'utilisateur connecté. Lève UnauthorizedAccessException si non authentifié.</summary>
    Guid UserId { get; }

    /// <summary>Email de l'utilisateur connecté.</summary>
    string Email { get; }

    /// <summary>Prénom + nom depuis les claims JWT.</summary>
    string FullName { get; }

    /// <summary>Rôles de l'utilisateur (Customer, Staff, Admin).</summary>
    IReadOnlyList<string> Roles { get; }

    bool IsAuthenticated { get; }

    bool IsInRole(string role);
}
```

---

### DTOs dans Application

### `Application/Auth/DTOs/AuthDtos.cs`

```csharp
namespace Application.Auth.DTOs;

/// <summary>Réponse retournée après login ou register réussi.</summary>
public sealed record AuthResponse(
    string    Token,
    DateTime  ExpiresAt,
    Guid      UserId,
    string    Email,
    string    FullName,
    string[]  Roles);

/// <summary>Profil utilisateur complet (sans les champs de sécurité).</summary>
public sealed record UserProfileDto(
    Guid              Id,
    string            Email,
    string            FirstName,
    string            LastName,
    string?           PhoneNumber,
    string?           Avatar,
    string            PreferredLanguage,
    DeliveryAddressDto? DefaultDeliveryAddress,
    DateTime          CreatedAt,
    string[]          Roles);

public sealed record DeliveryAddressDto(
    string Street,
    string City,
    string Province,
    string PostalCode,
    string Country);

public sealed record UpdateProfileRequest(
    string  FirstName,
    string  LastName,
    string? PhoneNumber,
    string? Avatar,
    string  PreferredLanguage,
    DeliveryAddressDto? DefaultDeliveryAddress);
```

---

## 8. TokenService

### `Infrastructure/Identity/TokenService.cs`

```csharp
namespace Infrastructure.Identity;

/// <summary>
/// Génère les JWT tokens avec les claims de l'utilisateur.
/// Injecté dans IdentityService uniquement — pas dans les controllers.
/// </summary>
public sealed class TokenService(IConfiguration config)
{
    private const int TokenExpiryHours = 8;

    public (string Token, DateTime ExpiresAt) GenerateToken(
        AppUser user, IList<string> roles)
    {
        var key         = GetSigningKey();
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt   = DateTime.UtcNow.AddHours(TokenExpiryHours);

        var claims = BuildClaims(user, roles);

        var token = new JwtSecurityToken(
            issuer:             config["Jwt:Issuer"],
            audience:           config["Jwt:Audience"],
            claims:             claims,
            notBefore:          DateTime.UtcNow,
            expires:            expiresAt,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private static List<Claim> BuildClaims(AppUser user, IList<string> roles)
    {
        var claims = new List<Claim>
        {
            // Sub = standard JWT claim pour l'identifiant
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()), // unique token id
            new("firstName",                   user.FirstName),
            new("lastName",                    user.LastName),
            new("fullName",                    user.FullName),
            new("preferredLanguage",           user.PreferredLanguage),
        };

        // ClaimTypes.NameIdentifier = standard .NET pour que User.FindFirstValue(ClaimTypes.NameIdentifier) fonctionne
        claims.Add(new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()));
        claims.Add(new Claim(ClaimTypes.Email, user.Email!));

        // Un claim par rôle — permettra [Authorize(Roles = "Admin")]
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        return claims;
    }

    private SymmetricSecurityKey GetSigningKey()
    {
        var rawKey = config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key est requis dans la configuration.");

        if (rawKey.Length < 32)
            throw new InvalidOperationException("Jwt:Key doit faire au moins 32 caractères.");

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(rawKey));
    }
}
```

---

## 9. IdentityService

### `Infrastructure/Identity/IdentityService.cs`

```csharp
namespace Infrastructure.Identity;

/// <summary>
/// Implémente IIdentityService — façade vers UserManager + SignInManager + TokenService.
/// Toute la logique d'authentification passe par ici.
/// </summary>
internal sealed class IdentityService(
    UserManager<AppUser>   userManager,
    SignInManager<AppUser> signInManager,
    RoleManager<AppRole>   roleManager,
    TokenService           tokenService,
    ILogger<IdentityService> logger)
    : IIdentityService
{
    // ── Register ─────────────────────────────────────────────────────────────

    public async Task<(Result Result, Guid UserId)> CreateUserAsync(
        string email, string firstName, string lastName,
        string password, CancellationToken ct = default)
    {
        var user = new AppUser
        {
            UserName  = email,          // UserName = Email dans notre cas (plus simple)
            Email     = email,
            FirstName = firstName,
            LastName  = lastName,
            CreatedAt = DateTime.UtcNow,
        };

        var identityResult = await userManager.CreateAsync(user, password);

        if (!identityResult.Succeeded)
        {
            var errors = string.Join("; ", identityResult.Errors.Select(e => e.Description));
            logger.LogWarning("Échec de création d'utilisateur {Email}: {Errors}", email, errors);
            return (Result.Failure(errors), Guid.Empty);
        }

        // Rôle par défaut — Customer
        await userManager.AddToRoleAsync(user, Roles.Customer);

        logger.LogInformation("Utilisateur créé : {Email} ({UserId})", email, user.Id);
        return (Result.Success(), user.Id);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public async Task<AuthResponse?> LoginAsync(
        string email, string password, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            logger.LogWarning("Tentative de connexion avec email inconnu : {Email}", email);
            return null;
        }

        // CheckPasswordSignInAsync gère le lockout automatiquement
        var result = await signInManager.CheckPasswordSignInAsync(
            user, password, lockoutOnFailure: true);

        if (!result.Succeeded)
        {
            if (result.IsLockedOut)
                logger.LogWarning("Compte verrouillé : {Email}", email);
            return null;
        }

        return await BuildAuthResponseAsync(user);
    }

    // ── Profil ────────────────────────────────────────────────────────────────

    public async Task<UserProfileDto?> GetUserProfileAsync(
        Guid userId, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return null;

        var roles = await userManager.GetRolesAsync(user);
        return MapToDto(user, [.. roles]);
    }

    public async Task<Result> UpdateProfileAsync(
        Guid userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        user.FirstName          = request.FirstName;
        user.LastName           = request.LastName;
        user.PhoneNumber        = request.PhoneNumber;
        user.Avatar             = request.Avatar;
        user.PreferredLanguage  = request.PreferredLanguage;
        user.UpdatedAt          = DateTime.UtcNow;

        if (request.DefaultDeliveryAddress is { } addr)
        {
            user.DefaultDeliveryAddress = new DeliveryAddress
            {
                Street     = addr.Street,
                City       = addr.City,
                Province   = addr.Province,
                PostalCode = addr.PostalCode,
                Country    = addr.Country,
            };
        }

        var result = await userManager.UpdateAsync(user);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(string.Join("; ", result.Errors.Select(e => e.Description)));
    }

    // ── Mot de passe ──────────────────────────────────────────────────────────

    public async Task<Result> ChangePasswordAsync(
        Guid userId, string currentPassword, string newPassword,
        CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        var result = await userManager.ChangePasswordAsync(user, currentPassword, newPassword);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(string.Join("; ", result.Errors.Select(e => e.Description)));
    }

    // ── Rôles ────────────────────────────────────────────────────────────────

    public async Task<Result> AssignRoleAsync(
        Guid userId, string role, CancellationToken ct = default)
    {
        if (!await roleManager.RoleExistsAsync(role))
            return Result.Failure($"Le rôle « {role} » n'existe pas.");

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        // Retirer les anciens rôles applicatifs avant d'assigner le nouveau
        var currentRoles = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, currentRoles);
        await userManager.AddToRoleAsync(user, role);

        return Result.Success();
    }

    public async Task<bool> EmailExistsAsync(string email, CancellationToken ct = default)
        => await userManager.FindByEmailAsync(email) is not null;

    // ── Helpers privés ────────────────────────────────────────────────────────

    private async Task<AuthResponse> BuildAuthResponseAsync(AppUser user)
    {
        var roles             = await userManager.GetRolesAsync(user);
        var (token, expiresAt) = tokenService.GenerateToken(user, roles);

        return new AuthResponse(
            Token:    token,
            ExpiresAt: expiresAt,
            UserId:   user.Id,
            Email:    user.Email!,
            FullName: user.FullName,
            Roles:    [.. roles]);
    }

    private static UserProfileDto MapToDto(AppUser user, string[] roles)
    {
        DeliveryAddressDto? addressDto = user.DefaultDeliveryAddress is { } a
            ? new(a.Street, a.City, a.Province, a.PostalCode, a.Country)
            : null;

        return new UserProfileDto(
            user.Id, user.Email!, user.FirstName, user.LastName,
            user.PhoneNumber, user.Avatar, user.PreferredLanguage,
            addressDto, user.CreatedAt, roles);
    }
}
```

---

## 10. CurrentUserService

### `Infrastructure/Services/CurrentUserService.cs`

```csharp
namespace Infrastructure.Services;

/// <summary>
/// Lit les claims du JWT depuis IHttpContextAccessor.
/// Enregistré en Scoped — valide pour la durée d'une requête HTTP.
/// </summary>
internal sealed class CurrentUserService(IHttpContextAccessor accessor)
    : ICurrentUserService
{
    private ClaimsPrincipal? Principal
        => accessor.HttpContext?.User;

    public Guid UserId
    {
        get
        {
            var raw = Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new UnauthorizedAccessException(
                    "UserId non disponible — utilisateur non authentifié.");
            return Guid.Parse(raw);
        }
    }

    public string Email
        => Principal?.FindFirstValue(ClaimTypes.Email)
           ?? throw new UnauthorizedAccessException("Email non disponible dans les claims.");

    public string FullName
        => Principal?.FindFirstValue("fullName") ?? string.Empty;

    public IReadOnlyList<string> Roles
        => Principal?
            .FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .ToList()
           ?? [];

    public bool IsAuthenticated
        => Principal?.Identity?.IsAuthenticated is true;

    public bool IsInRole(string role)
        => Principal?.IsInRole(role) is true;
}
```

---

## 11. Commands et Handlers

### `Application/Auth/Commands/Register/RegisterCommand.cs`

```csharp
namespace Application.Auth.Commands.Register;

public sealed record RegisterCommand(
    string Email,
    string FirstName,
    string LastName,
    string Password,
    string ConfirmPassword) : ICommand<AuthResponse>;
```

---

### `Application/Auth/Commands/Register/RegisterCommandValidator.cs`

```csharp
namespace Application.Auth.Commands.Register;

public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator(IIdentityService identity)
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress().WithMessage("Adresse courriel invalide.")
            .MustAsync(async (email, ct) => !await identity.EmailExistsAsync(email, ct))
            .WithMessage("Cette adresse courriel est déjà utilisée.");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("Le prénom est requis.")
            .MaximumLength(100);

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Le nom est requis.")
            .MaximumLength(100);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8).WithMessage("Le mot de passe doit avoir au moins 8 caractères.")
            .Matches("[A-Z]").WithMessage("Le mot de passe doit contenir au moins une majuscule.")
            .Matches("[0-9]").WithMessage("Le mot de passe doit contenir au moins un chiffre.")
            .Matches("[^a-zA-Z0-9]").WithMessage("Le mot de passe doit contenir un caractère spécial.");

        RuleFor(x => x.ConfirmPassword)
            .Equal(x => x.Password).WithMessage("Les mots de passe ne correspondent pas.");
    }
}
```

---

### `Application/Auth/Commands/Register/RegisterCommandHandler.cs`

```csharp
namespace Application.Auth.Commands.Register;

internal sealed class RegisterCommandHandler(IIdentityService identity)
    : ICommandHandler<RegisterCommand, AuthResponse>
{
    public async ValueTask<AuthResponse> Handle(
        RegisterCommand cmd, CancellationToken ct)
    {
        var (result, _) = await identity.CreateUserAsync(
            cmd.Email, cmd.FirstName, cmd.LastName, cmd.Password, ct);

        if (!result.IsSuccess)
            throw new BusinessRuleException(result.Error!);

        // Login immédiat après inscription
        var auth = await identity.LoginAsync(cmd.Email, cmd.Password, ct);

        return auth ?? throw new BusinessRuleException(
            "Impossible de se connecter après l'inscription.");
    }
}
```

---

### `Application/Auth/Commands/Login/LoginCommand.cs`

```csharp
namespace Application.Auth.Commands.Login;

public sealed record LoginCommand(string Email, string Password) : ICommand<AuthResponse>;
```

---

### `Application/Auth/Commands/Login/LoginCommandValidator.cs`

```csharp
namespace Application.Auth.Commands.Login;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress().WithMessage("Format de courriel invalide.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Le mot de passe est requis.");
    }
}
```

---

### `Application/Auth/Commands/Login/LoginCommandHandler.cs`

```csharp
namespace Application.Auth.Commands.Login;

internal sealed class LoginCommandHandler(IIdentityService identity)
    : ICommandHandler<LoginCommand, AuthResponse>
{
    public async ValueTask<AuthResponse> Handle(
        LoginCommand cmd, CancellationToken ct)
    {
        var auth = await identity.LoginAsync(cmd.Email, cmd.Password, ct);

        // Ne pas préciser si c'est l'email ou le mdp qui est incorrect (sécurité)
        return auth ?? throw new UnauthorizedAccessException(
            "Identifiants incorrects ou compte verrouillé.");
    }
}
```

---

### `Application/Auth/Queries/GetMyProfile/GetMyProfileQuery.cs`

```csharp
namespace Application.Auth.Queries.GetMyProfile;

public sealed record GetMyProfileQuery : IQuery<UserProfileDto>;
```

---

### `Application/Auth/Queries/GetMyProfile/GetMyProfileQueryHandler.cs`

```csharp
namespace Application.Auth.Queries.GetMyProfile;

internal sealed class GetMyProfileQueryHandler(
    IIdentityService    identity,
    ICurrentUserService currentUser)
    : IQueryHandler<GetMyProfileQuery, UserProfileDto>
{
    public async ValueTask<UserProfileDto> Handle(
        GetMyProfileQuery query, CancellationToken ct)
    {
        var profile = await identity.GetUserProfileAsync(currentUser.UserId, ct);

        return profile ?? throw new NotFoundException(
            nameof(AppUser), currentUser.UserId);
    }
}
```

---

## 12. AuthController

```csharp
namespace Api.Controllers;

/// <summary>Endpoints d'authentification — mince, délègue tout au Dispatcher.</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
public sealed class AuthController(Dispatcher dispatcher) : ControllerBase
{
    /// <summary>Créer un compte.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterCommand cmd, CancellationToken ct)
    {
        var result = await dispatcher.Send(cmd, ct);
        return Ok(result);
    }

    /// <summary>Se connecter.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginCommand cmd, CancellationToken ct)
    {
        var result = await dispatcher.Send(cmd, ct);
        return Ok(result);
    }

    /// <summary>Profil de l'utilisateur connecté.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<UserProfileDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var result = await dispatcher.Query(new GetMyProfileQuery(), ct);
        return Ok(result);
    }

    /// <summary>Mettre à jour son profil.</summary>
    [HttpPut("me")]
    [Authorize]
    [ProducesResponseType<UserProfileDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateProfileCommand cmd, CancellationToken ct)
    {
        var result = await dispatcher.Send(cmd, ct);
        return Ok(result);
    }

    /// <summary>Changer son mot de passe.</summary>
    [HttpPost("me/change-password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordCommand cmd, CancellationToken ct)
    {
        await dispatcher.Send(cmd, ct);
        return NoContent();
    }

    /// <summary>Assigner un rôle à un utilisateur (Admin seulement).</summary>
    [HttpPost("{userId:guid}/role")]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AssignRole(
        Guid userId, [FromBody] AssignRoleCommand cmd, CancellationToken ct)
    {
        await dispatcher.Send(cmd with { UserId = userId }, ct);
        return NoContent();
    }
}
```

---

## 13. Seeder

### `Infrastructure/Identity/IdentitySeeder.cs`

```csharp
namespace Infrastructure.Identity;

/// <summary>
/// Crée les rôles et le compte admin au premier démarrage.
/// Appelé depuis Program.cs après app.Build().
/// </summary>
public static class IdentitySeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        using var scope       = sp.CreateScope();
        var roleManager       = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
        var userManager       = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var logger            = scope.ServiceProvider.GetRequiredService<ILogger<ApplicationDbContext>>();

        // ── Rôles ──────────────────────────────────────────────────────────
        string[] roles = [Roles.Customer, Roles.Staff, Roles.Admin];
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new AppRole(role));
                logger.LogInformation("Rôle créé : {Role}", role);
            }
        }

        // ── Compte Admin ───────────────────────────────────────────────────
        const string adminEmail    = "admin@abristempo.local";
        const string adminPassword = "Admin@123!";   // À changer via user-secrets en prod

        if (await userManager.FindByEmailAsync(adminEmail) is null)
        {
            var admin = new AppUser
            {
                UserName          = adminEmail,
                Email             = adminEmail,
                EmailConfirmed    = true,
                FirstName         = "Admin",
                LastName          = "AbrisTempo",
                PreferredLanguage = "fr",
                CreatedAt         = DateTime.UtcNow,
            };

            var result = await userManager.CreateAsync(admin, adminPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, Roles.Admin);
                logger.LogInformation("Compte admin créé : {Email}", adminEmail);
            }
            else
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                logger.LogError("Échec création admin : {Errors}", errors);
            }
        }
    }
}
```

---

## 14. DI Registration

### `Infrastructure/DependencyInjection.cs` (section Identity)

```csharp
namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        // ── DbContext unique (Identity + domaine métier) ───────────────────
        services.AddDbContext<ApplicationDbContext>(opts =>
            opts.UseSqlServer(
                config.GetConnectionString("Default"),
                sql => sql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)
            ));

        // Enregistrement de l'interface Application → contexte concret
        services.AddScoped<IApplicationDbContext>(
            sp => sp.GetRequiredService<ApplicationDbContext>());

        // ── Interceptors ─────────────────────────────────────────────────────
        services.AddSingleton<SoftDeleteInterceptor>();
        services.AddSingleton<AuditInterceptor>();

        // ── ASP.NET Core Identity ─────────────────────────────────────────────
        services
            .AddIdentity<AppUser, AppRole>(opts =>
            {
                // Mot de passe
                opts.Password.RequiredLength          = 8;
                opts.Password.RequireDigit            = true;
                opts.Password.RequireLowercase        = true;
                opts.Password.RequireUppercase        = true;
                opts.Password.RequireNonAlphanumeric  = true;
                opts.Password.RequiredUniqueChars     = 1;

                // Email unique obligatoire
                opts.User.RequireUniqueEmail = true;

                // Lockout — 5 tentatives → 10 min
                opts.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(10);
                opts.Lockout.MaxFailedAccessAttempts = 5;
                opts.Lockout.AllowedForNewUsers      = true;

                // Pas de confirmation d'email obligatoire (à activer en prod)
                opts.SignIn.RequireConfirmedEmail = false;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        // ── JWT ───────────────────────────────────────────────────────────────
        var jwtKey = config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key manquant.");

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
                    ValidateIssuer   = true,
                    ValidIssuer      = config["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience    = config["Jwt:Audience"],
                    ValidateLifetime = true,
                    ClockSkew        = TimeSpan.Zero,  // Pas de tolérance sur l'expiration
                };

                // Support des erreurs détaillées en dev
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

        // ── Authorization ─────────────────────────────────────────────────────
        services.AddAuthorizationBuilder()
            .SetDefaultPolicy(new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build())
            .AddPolicy("StaffOrAbove", policy =>
                policy.RequireRole(Roles.Staff, Roles.Admin))
            .AddPolicy("AdminOnly", policy =>
                policy.RequireRole(Roles.Admin));

        // ── Services Identity ─────────────────────────────────────────────────
        services.AddScoped<TokenService>();
        services.AddScoped<IIdentityService, IdentityService>();

        // ── CurrentUserService ────────────────────────────────────────────────
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // ── Seeder de fichier local ───────────────────────────────────────────
        // (appelé depuis Program.cs, pas ici)

        return services;
    }
}
```

---

## 15. Program.cs

```csharp
// src/Api/Program.cs

var builder = WebApplication.CreateBuilder(args);

// ── Infrastructure (DbContext + Identity + JWT + services) ────────────────────
builder.Services.AddInfrastructure(builder.Configuration);

// ── Mediator maison + FluentValidation ───────────────────────────────────────
builder.Services.AddScoped<Dispatcher>();
builder.Services.Scan(scan => scan
    .FromAssemblies(typeof(Application.AssemblyMarker).Assembly)
    .AddClasses(c => c.AssignableTo(typeof(ICommandHandler<,>)))
        .AsImplementedInterfaces().WithScopedLifetime()
    .AddClasses(c => c.AssignableTo(typeof(IQueryHandler<,>)))
        .AsImplementedInterfaces().WithScopedLifetime());
builder.Services.AddValidatorsFromAssembly(typeof(Application.AssemblyMarker).Assembly);

// ── Contrôleurs ───────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddApiVersioning(opt =>
{
    opt.DefaultApiVersion = new ApiVersion(1, 0);
    opt.AssumeDefaultVersionWhenUnspecified = true;
});

// ── Exception Handler (RFC 9457) ──────────────────────────────────────────────
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// ── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opts => opts.AddPolicy("Frontend", policy =>
    policy.WithOrigins(builder.Configuration["AllowedOrigins"]!.Split(','))
          .AllowAnyHeader()
          .AllowAnyMethod()));

// ── OpenAPI / Scalar (avec support Bearer) ────────────────────────────────────
builder.Services.AddOpenApi(opts =>
{
    opts.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
});

var app = builder.Build();

// ── Seeder ────────────────────────────────────────────────────────────────────
await IdentitySeeder.SeedAsync(app.Services);

// ── Middleware Pipeline ───────────────────────────────────────────────────────
app.UseExceptionHandler();
app.UseCors("Frontend");
app.UseHttpsRedirection();
app.UseAuthentication();    // ← Valide le JWT Bearer
app.UseAuthorization();     // ← Applique les policies
app.MapControllers();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

await app.RunAsync();
```

---

## 16. appsettings.json

```json
{
  "AllowedHosts": "*",
  "AllowedOrigins": "http://localhost:4200",

  "ConnectionStrings": {
    "Default": "Server=(localdb)\\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;MultipleActiveResultSets=true;"
  },

  "Jwt": {
    "Key": "REMPLACER_PAR_USER_SECRETS_EN_DEV",
    "Issuer": "AbrisTempoLocal.Api",
    "Audience": "AbrisTempoLocal.Client"
  },

  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  }
}
```

> ⚠️ **Ne jamais committer `Jwt:Key` dans le dépôt.**
> En dev → `dotnet user-secrets`. En prod → Azure Key Vault ou variable d'environnement.

---

## 17. Commandes EF Core

Une seule migration pour tout (Identity + domaine métier) :

```bash
# Depuis la racine de la solution

# 1. Créer la migration initiale
dotnet ef migrations add InitialCreate \
  --project src/Infrastructure \
  --startup-project src/Api \
  --context ApplicationDbContext \
  --output-dir Persistence/Migrations

# 2. Appliquer
dotnet ef database update \
  --project src/Infrastructure \
  --startup-project src/Api \
  --context ApplicationDbContext

# Ajouter un champ à AppUser plus tard
dotnet ef migrations add AddUserPreferences \
  --project src/Infrastructure \
  --startup-project src/Api \
  --context ApplicationDbContext \
  --output-dir Persistence/Migrations
```

---

## 18. Schéma final des tables

```
AspNetUsers              ← AppUser étendu (UNE SEULE TABLE)
─────────────────────────────────────────────────────────────────
Id                       uniqueidentifier  PK
UserName / NormalizedUserName
Email / NormalizedEmail
EmailConfirmed
PasswordHash
SecurityStamp
ConcurrencyStamp
PhoneNumber / PhoneNumberConfirmed
TwoFactorEnabled
LockoutEnd / LockoutEnabled / AccessFailedCount
FirstName                nvarchar(100)     NOT NULL
LastName                 nvarchar(100)     NOT NULL
Avatar                   nvarchar(500)     NULL
PreferredLanguage        nvarchar(2)       DEFAULT 'fr'
DeliveryAddress_Street   nvarchar(200)     NULL    ┐
DeliveryAddress_City     nvarchar(100)     NULL    │  Owned Entity
DeliveryAddress_Province nvarchar(2)       NULL    │  (colonnes dans
DeliveryAddress_PostalCode nvarchar(7)     NULL    │   AspNetUsers)
DeliveryAddress_Country  nvarchar(50)      NULL    ┘
CreatedAt                datetime2         NOT NULL
UpdatedAt                datetime2         NULL

AspNetRoles              ← AppRole étendu
AspNetUserRoles          ← mapping User ↔ Role
AspNetUserClaims
AspNetUserLogins
AspNetUserTokens
AspNetRoleClaims

Products                 ─── CustomerId (FK → AspNetUsers.Id) ───┐
Orders                   ─── CustomerId (FK → AspNetUsers.Id) ───┤  FK réelle
BookingSlots             ─── CustomerId (FK → AspNetUsers.Id) ───┤  possible grâce
RentalContracts          ─── CustomerId (FK → AspNetUsers.Id) ───┘  au DbContext unique
```

---

## Résumé des décisions

| Décision | Choix | Raison |
|----------|-------|--------|
| Emplacement `AppUser` | `Infrastructure/Identity/` | IdentityUser = dépendance infra |
| Profil utilisateur | Colonnes dans `AspNetUsers` | Zéro doublon de table |
| DbContext | 1 seul (`ApplicationDbContext`) | FK réelles, 1 migration, plus simple |
| PK Identity | `Guid` (via `IdentityUser<Guid>`) | Cohérence, UUID natif SQL, distributed-safe |
| Adresse par défaut | Owned Entity (colonnes préfixées) | Pas de table `Addresses` séparée |
| JWT expiry | 8 heures | Équilibre UX / sécurité (ajuster en prod) |
| Lockout | 5 tentatives / 10 min | Protection brute-force par défaut |
| UserName | = Email | Simplifie la gestion (pas de username séparé) |
