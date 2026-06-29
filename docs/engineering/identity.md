# Identité — authentification & autorisation (AbrisTempo Local)

Référence approfondie sur l'auth/authz du backend, **ancrée au code réel**. Pour le guide rapide
des conventions, voir le `CLAUDE.md` racine ; pour ajouter une fonctionnalité, voir
[`adding-a-feature.md`](adding-a-feature.md).

> **Un seul `ApplicationDbContext`** gère Identity **et** les entités métier (il n'y a **pas** de
> `AppIdentityDbContext` ni de seconde chaîne de connexion). `ApplicationDbContext` hérite de
> `IdentityDbContext<AppUser, AppRole, Guid, …>` et implémente `IApplicationDbContext`.

---

## 1 · Principe — pas de table de profil dupliquée

`AppUser` **étend** `IdentityUser<Guid>` et **est** le client : aucune entité `Customer` /
`UserProfile` séparée. Toutes les données de profil (prénom, nom, avatar, langue, adresse de
livraison par défaut, taux horaire des employés) vivent comme colonnes additionnelles sur la table
`AspNetUsers`. Les entités métier (`Order`, `RentalContract`, `BookingSlot`) portent une FK réelle
vers `AspNetUsers.Id` — possible précisément parce qu'Identity et le domaine partagent un seul
contexte.

Avantages : zéro jointure pour lire le profil complet, une seule migration, un seul pipeline de
tests d'intégration.

---

## 2 · Où vit chaque pièce

| Pièce | Emplacement | Couche |
|-------|-------------|--------|
| `AppUser`, `AppRole` | `Infrastructure/Identity/` | Infrastructure (héritent d'ASP.NET Identity) |
| `IdentityService` (impl. de `IIdentityService`) | `Infrastructure/Identity/IdentityService.cs` | Infrastructure |
| `TokenService` (génération JWT) | `Infrastructure/Identity/TokenService.cs` | Infrastructure |
| `IdentitySeeder` (rôles + admin par défaut) | `Infrastructure/Identity/IdentitySeeder.cs` | Infrastructure |
| `ExpressAccountService` (comptes invités) | `Infrastructure/Identity/ExpressAccountService.cs` | Infrastructure |
| `AppUserConfiguration` (mapping EF) | `Infrastructure/Identity/Configurations/` | Infrastructure |
| `CurrentUserService` (claims du JWT) | `Infrastructure/Services/CurrentUserService.cs` | Infrastructure |
| `IIdentityService`, `ICurrentUserService` | `Application/Common/Interfaces/` | Application (abstractions) |
| DTOs (`AuthResponse`, `UserProfileDto`, …) | `Application/Auth/DTOs/` | Application |
| `Roles` (constantes) | `Domain/Constants/Roles.cs` | Domain |

**Pourquoi `AppUser` dans Infrastructure ?** `IdentityUser<Guid>` est une classe ASP.NET Core
Identity → dépendance d'infrastructure. La couche Application ne touche jamais `AppUser`
directement : elle passe par `IIdentityService` / `ICurrentUserService` (frontière DIP). Les
handlers n'importent rien de `Microsoft.AspNetCore.Identity`.

---

## 3 · `AppUser` et `AppRole`

`AppUser : IdentityUser<Guid>` (`Infrastructure/Identity/AppUser.cs`) ajoute, au-delà des champs
fournis par Identity (`Id`, `Email`, `UserName`, `PasswordHash`, `PhoneNumber`, lockout…) :

| Champ | Type | Rôle |
|-------|------|------|
| `FirstName`, `LastName` | `string` | Profil ; `FullName` est calculé (`$"{FirstName} {LastName}".Trim()`). |
| `Avatar` | `string?` | URL de la photo de profil. |
| `PreferredLanguage` | `string` (`"fr"`/`"en"`, défaut `"fr"`) | Langue d'affichage. |
| `HourlyRate` | `decimal?` | Taux horaire CAD d'un employé `Staff` (EPIC 8, récap de paie ; `null` = non défini). |
| `DefaultDeliveryAddress` | `Address?` (Owned Entity) | Adresse de livraison par défaut, colonnes préfixées `DefaultAddress_*` dans `AspNetUsers`. `Address` est le Value Object de `Domain.ValueObjects`. |
| `IsExpress` | `bool` (défaut `false`) | Compte « express » passwordless pour invité (voir §8). |
| `CreatedAt`, `UpdatedAt` | `DateTime` / `DateTime?` | Audit. |

`AppRole : IdentityRole<Guid>` — PK `Guid` (cohérence avec `AppUser`), enrichissable sans impacter
les migrations Identity.

> **Mapping de l'adresse owned (lesson L-001).** `DefaultDeliveryAddress` est mappée en `OwnsOne`
> dans `AppUserConfiguration` (colonnes préfixées, aucune table séparée). Vérifier toute évolution
> sur une vraie LocalDB, pas seulement en InMemory.

---

## 4 · Le `DbContext` unique

`Infrastructure/Persistence/ApplicationDbContext.cs` :

```csharp
public sealed class ApplicationDbContext(
    DbContextOptions<ApplicationDbContext> options,
    SoftDeleteInterceptor softDelete,
    AuditInterceptor audit)
    : IdentityDbContext<
        AppUser, AppRole, Guid,
        IdentityUserClaim<Guid>, IdentityUserRole<Guid>,
        IdentityUserLogin<Guid>, IdentityRoleClaim<Guid>, IdentityUserToken<Guid>>(options),
      IApplicationDbContext
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order>   Orders   => Set<Order>();
    // … autres entités métier …

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);   // obligatoire — crée les 7 tables Identity
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

Les 8 types génériques `Guid` garantissent que les tables Identity ont des PK `Guid` (et non
`string`). `IApplicationDbContext` (défini dans Application) est l'abstraction injectée dans les
handlers — Application ne voit jamais le type concret.

---

## 5 · Interfaces Application

### `IIdentityService` (`Application/Common/Interfaces/IIdentityService.cs`)

Façade vers `UserManager` / `SignInManager` / `RoleManager` / `TokenService`. Les méthodes
retournent `Result` / `Result<T>` (chemin d'erreur attendu) ou des DTOs. Surface actuelle :

- `RegisterAsync(email, username, password, firstName, lastName)` → `Result<AuthResponse>` (courriel **et** nom d'utilisateur uniques).
- `LoginAsync(identifier, password)` → `Result<AuthResponse>` — `identifier` = courriel **ou** nom d'utilisateur.
- `GenerateTokenAsync(userId)` → `string`.
- `AssignRoleAsync` / `RemoveRoleAsync` / `GetUserRolesAsync(userId)`.
- `GetProfileAsync(userId)` → `UserProfileDto?`.
- `GetAllUsersAsync()` (admin), `GetStaffMembersAsync()`, `GetStaffWithRatesAsync()`, `SetHourlyRateAsync(employeeId, hourlyRate?)` (EPIC 8/11).
- `SearchCustomersAsync(term, take)` — recherche client par nom/courriel, exclut les comptes express.
- `UpdateProfileAsync`, `UpdateAvatarAsync`, `ChangePasswordAsync`.
- `GeneratePasswordResetTokenAsync(email)` / `ResetPasswordAsync(email, token, newPassword)` — anti-énumération : l'appelant reste silencieux sur l'existence du compte.
- `IsUsernameTakenAsync` / `IsEmailTakenAsync` — aide à l'inscription.

`AuthResponse` (record) : `UserId, Email, Username, FirstName, LastName, FullName, Token, Roles, Avatar?`.

> Ces signatures **font foi** ; le but est qu'Application ne dépende d'aucune classe Identity. Si tu
> ajoutes une opération auth, ajoute la méthode ici et implémente-la dans `IdentityService`.

### `ICurrentUserService` (`Application/Common/Interfaces/ICurrentUserService.cs`)

Lit les claims du JWT via `IHttpContextAccessor` (implémentée dans `Infrastructure/Services/`,
enregistrée en `Scoped`). Expose l'`UserId`, l'`Email`, le `FullName`, les `Roles`,
`IsAuthenticated`, `IsInRole(role)`. C'est la seule façon pour un handler d'obtenir l'identité de
l'appelant.

---

## 6 · `TokenService` — génération JWT

`Infrastructure/Identity/TokenService.cs` génère le JWT signé HMAC-SHA256 à partir de la config
`Jwt:*`. Claims posés : `sub` / `ClaimTypes.NameIdentifier` (= `userId`), `email`, `jti`,
`firstName`, `lastName`, `fullName`, `preferredLanguage`, et **un claim `ClaimTypes.Role` par
rôle** (permet `[Authorize(Roles = …)]`). Injecté **uniquement** dans `IdentityService`, jamais
dans un controller.

---

## 7 · DI, JWT & policies (`Infrastructure/DependencyInjection.cs`)

`AddInfrastructure(...)` câble tout (le `Program.cs` n'enregistre que `IDispatcher`) :

- **Identity** : `AddIdentity<AppUser, AppRole>` + `AddEntityFrameworkStores<ApplicationDbContext>` + `AddDefaultTokenProviders`. Options : mot de passe ≥ 8 caractères (chiffre + minuscule + majuscule + non-alphanumérique), `RequireUniqueEmail`, lockout 5 tentatives / 10 min.
- **JWT Bearer** : `ValidateIssuerSigningKey` / `ValidateIssuer` / `ValidateAudience` / `ValidateLifetime`, `ClockSkew = TimeSpan.Zero`. En cas de `SecurityTokenExpiredException`, l'événement ajoute l'en-tête `Token-Expired: true`.
- **Policies** (`AddAuthorizationBuilder`) :
  - `StaffOrAbove` → `RequireRole(Roles.Staff, Roles.Admin)`.
  - `AdminOnly` → `RequireRole(Roles.Admin)`.
  - **Aucune** politique globale `RequireAuthenticatedUser` : chaque endpoint décide via `[Authorize]` / `[Authorize(Policy = …)]` / `[AllowAnonymous]`.
- **Services** : `TokenService`, `IIdentityService → IdentityService`, `IExpressAccountService → ExpressAccountService` (Scoped) ; `ICurrentUserService → CurrentUserService` + `AddHttpContextAccessor`.

### Rôles (`Domain/Constants/Roles.cs`)

`Customer`, `Staff`, `Admin` (via `nameof`). Combinaisons prêtes pour `[Authorize(Roles = …)]` :
`StaffOrAbove = "Staff,Admin"`, `All = "Customer,Staff,Admin"`. Jamais de magic string de rôle
ailleurs.

---

## 8 · Comptes « express » (invités) — `ExpressAccountService`

Pour la commande/location/réservation **sans connexion** (EPIC F), un compte express est créé en
silence : `IsExpress = true` et **passwordless** (`PasswordHash == null`). Un tel compte **ne peut
jamais se connecter** (le contrôle de mot de passe échoue), il sert uniquement à rattacher la
transaction à un `CustomerId` réel. `SearchCustomersAsync` exclut ces comptes anonymes.

> Toute ouverture d'un endpoint à `[AllowAnonymous]` exige une revue à deux volets : aucun chemin
> ne doit pouvoir émettre un JWT pour un compte express, et les actions sœurs sur le même
> controller restent protégées par le `[Authorize]` de classe (lessons L-028, L-029).

---

## 9 · Seeder (`IdentitySeeder`)

Exécuté au démarrage depuis `Program.cs`. Idempotent :

1. Crée les rôles `Admin`, `Staff`, `Customer` s'ils n'existent pas (`RoleExistsAsync`).
2. Crée le compte admin par défaut s'il est absent : `admin@abrisauto.com` / `Admin123!`,
   `EmailConfirmed = true`, rôle `Admin`.

> Mot de passe admin de **dev uniquement** — à changer via user-secrets / variable d'environnement
> en déploiement réel.

---

## 10 · Configuration & migrations

### `appsettings.json` (dev)

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=True"
  },
  "Jwt": {
    "Key": "<32+ caractères — user-secrets en dev, Key Vault en prod>",
    "Issuer": "AbrisAutoOutaouais.API",
    "Audience": "AbrisAutoOutaouais.CLIENT"
  }
}
```

> Ne **jamais** committer `Jwt:Key`. Dev → `dotnet user-secrets` ; prod → Azure Key Vault /
> variable d'environnement.

### Migrations EF Core — un seul contexte

Migrations dans `Infrastructure/Persistence/Migrations` (`--context` inutile, il n'y en a qu'un) :

```powershell
dotnet ef migrations add <Name> `
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure `
  --startup-project src/AbrisAutoOutaouais-WebApp.API `
  --output-dir Persistence/Migrations

dotnet ef database update `
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure `
  --startup-project src/AbrisAutoOutaouais-WebApp.API
```

Une seule migration couvre les tables Identity (`AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`,
`AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens`, `AspNetRoleClaims`) **et** les entités
métier.

---

## 11 · Résumé des décisions

| Décision | Choix | Raison |
|----------|-------|--------|
| Emplacement `AppUser` | `Infrastructure/Identity/` | `IdentityUser` = dépendance infra |
| Profil utilisateur | Colonnes sur `AspNetUsers` | Zéro doublon de table |
| `DbContext` | 1 seul (`ApplicationDbContext`) | FK réelles, 1 migration, plus simple |
| PK Identity | `Guid` | Cohérence, UUID natif SQL |
| Adresse par défaut | Owned Entity (`DefaultAddress_*`) | Pas de table `Addresses` séparée |
| Comptes invités | `IsExpress` + passwordless | Achat sans compte, sans login possible |
| Autorisation | Policies nommées, pas de défaut global | Chaque endpoint décide explicitement |
