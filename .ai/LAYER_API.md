# LAYER_API.md — Couche Api

Couche HTTP mince. Mappe les requêtes HTTP vers le Dispatcher et retourne le résultat.
**Aucune logique métier** dans les controllers.

---

## Règle d'or

Un controller ne fait que trois choses :
1. Recevoir la requête HTTP (binding automatique).
2. Dispatcher vers Application (`await dispatcher.DispatchAsync(cmd, ct)`).
3. Retourner le résultat HTTP (`Ok(result)`, `Created(...)`, `NoContent()`).

Le controller injecte `IDispatcher` (l'interface, pas la classe `Dispatcher`).
Zéro `try/catch` — le `GlobalExceptionHandler` gère tout.

---

## Arborescence complète

> **Namespaces** : tous les types Api vivent sous `AbrisAutoOutaouais_WebApp.API.*`
> (API en MAJUSCULES, underscore). Le `GlobalExceptionHandler` est dans le
> sous-dossier `Middlewares/`.

```
src/AbrisAutoOutaouais-WebApp.API/
├── AbrisAutoOutaouais-WebApp.API.csproj
├── Program.cs                      ← composition root
├── appsettings.json
├── appsettings.Development.json    ← overrides dev (pas de secrets ici)
├── WeatherForecast.cs              ← résidu de scaffolding (à supprimer)
│
├── Middlewares/
│   └── GlobalExceptionHandler.cs   ← mappe exceptions → RFC 9457 ProblemDetails
│
└── Controllers/
    ├── ProductsController.cs       ← GET /products, GET /products/{slug} (POST/PUT/DELETE à venir)
    ├── OrdersController.cs         ← [Authorize] — endpoints à venir (squelette commenté)
    ├── BookingsController.cs       ← GET /bookings/available-slots (POST/GET my à venir)
    ├── AuthController.cs           ← POST /auth/register, POST /auth/login, GET /auth/me
    └── WeatherForecastController.cs ← résidu de scaffolding (à supprimer)
```

> **État actuel** : seuls quelques endpoints sont actifs. Les actions d'écriture
> (POST/PUT/DELETE produits, commandes, réservations) existent souvent en commentaire
> dans les controllers et seront décommentées au fur et à mesure. Il n'y a PAS encore
> de `RentalsController`. Le dossier `wwwroot/uploads/products/` n'est pas créé par
> défaut — à créer manuellement quand l'upload d'images sera branché.

---

## Api.csproj

```xml
<!-- src/AbrisAutoOutaouais-WebApp.API/AbrisAutoOutaouais-WebApp.API.csproj -->
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <UserSecretsId>abristempo-api</UserSecretsId>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\AbrisAutoOutaouais-WebApp.Application\AbrisAutoOutaouais-WebApp.Application.csproj" />
    <ProjectReference Include="..\AbrisAutoOutaouais-WebApp.Infrastructure\AbrisAutoOutaouais-WebApp.Infrastructure.csproj" />
    <PackageReference Include="Asp.Versioning.Mvc"            Version="8.*" />
    <PackageReference Include="Microsoft.AspNetCore.OpenApi"   Version="10.*" />
  </ItemGroup>
</Project>
```

---

## Program.cs

```csharp
// src/AbrisAutoOutaouais-WebApp.API/Program.cs
var builder = WebApplication.CreateBuilder(args);

// ── Infrastructure (DbContext, Identity, JWT, services, handlers Scrutor) ─────
// AddInfrastructure enregistre AUSSI les handlers CQRS (Scrutor) et les validateurs
// FluentValidation (AddValidatorsFromAssembly) — pas Program.cs.
builder.Services.AddInfrastructure(builder.Configuration);

// ── Mediator Dispatcher ───────────────────────────────────────────────────────
builder.Services.AddScoped<IDispatcher, Dispatcher>();

// ── Contrôleurs ───────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddApiVersioning(opt =>
{
    opt.DefaultApiVersion                  = new ApiVersion(1, 0);
    opt.AssumeDefaultVersionWhenUnspecified = true;
    opt.ReportApiVersions                  = true;
});

// ── Exception Handler (RFC 9457 ProblemDetails) ───────────────────────────────
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opts => opts.AddPolicy("Frontend", policy =>
    policy.WithOrigins(builder.Configuration["AllowedOrigins"]!.Split(','))
          .AllowAnyHeader()
          .AllowAnyMethod()));

// ── OpenAPI / Scalar avec support Bearer ──────────────────────────────────────
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Seeder (rôles + compte admin) ─────────────────────────────────────────────
await IdentitySeeder.SeedAsync(app.Services);

// ── Middleware pipeline ────────────────────────────────────────────────────────
// Ordre CRITIQUE — ne pas modifier
app.UseExceptionHandler();       // 1. Catch toutes les exceptions
app.UseHttpsRedirection();       // 2. Force HTTPS
app.UseStaticFiles();            // 3. wwwroot (uploads)
app.UseCors("Frontend");         // 4. CORS avant auth
app.UseAuthentication();         // 5. Valide le JWT Bearer
app.UseAuthorization();          // 6. Applique [Authorize]
app.MapControllers();            // 7. Route vers les controllers

if (app.Environment.IsDevelopment())
    app.MapOpenApi();            // Scalar UI en dev seulement

await app.RunAsync();
```

> **Autorisation** : il n'y a **AUCUNE** politique globale « authentifié par défaut »
> (pas de fallback policy). Les endpoints s'inscrivent explicitement à l'auth via
> `[Authorize]`, et les endpoints publics portent `[AllowAnonymous]`. Les seules
> politiques nommées enregistrées (dans `AddInfrastructure`) sont `StaffOrAbove`
> et `AdminOnly`.

---

## Migrations EF Core (un seul DbContext)

Depuis la racine de la solution :

```bash
dotnet ef migrations add <Name> \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API \
  --output-dir Persistence/Migrations
```

---

## Middlewares/GlobalExceptionHandler.cs

```csharp
namespace AbrisAutoOutaouais_WebApp.API.Middlewares;

/// <summary>
/// Mappe les exceptions Domain vers RFC 9457 ProblemDetails.
/// Enregistré via AddExceptionHandler&lt;T&gt; dans Program.cs.
/// Remplace les try/catch dans les controllers.
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
            Status = statusCode,
            Title  = title,
            Detail = detail,
            Extensions = { ["traceId"] = httpContext.TraceIdentifier },
        }, ct);

        return true;
    }
}
```

---

## Controllers/

### `Controllers/ProductsController.cs`

Variante de référence : route versionnée + primary constructor + `sealed`.

```csharp
namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class ProductsController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Liste paginée + filtres.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<PaginatedList<ProductDto>>(200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 12,
        [FromQuery] string? category = null, [FromQuery] string? search = null,
        CancellationToken ct = default)
        => Ok(await dispatcher.DispatchAsync(
            new GetAllProductsQuery(page, pageSize, category, search), ct));

    /// <summary>Détail par slug (URL SEO-friendly).</summary>
    [HttpGet("{slug}")]
    [AllowAnonymous]
    [ProducesResponseType<ProductDto>(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetProductBySlugQuery(slug), ct));

    // ── Endpoints d'écriture à venir (actuellement commentés dans le code) ──────
    // POST   (Authorize Roles = Roles.Admin)  → CreateProductCommand
    // PUT    {id:guid} (Authorize Roles = Admin) → UpdateProductCommand
    // DELETE {id:guid} (Authorize Roles = Admin) → DeleteProductCommand (soft delete)
    // Modèle d'écriture :
    //   var id = await dispatcher.DispatchAsync(cmd, ct);
    //   return CreatedAtAction(nameof(GetBySlug), new { slug = cmd.Slug, version = "1.0" }, id);
}
```

### `Controllers/OrdersController.cs`

Le controller est sécurisé au niveau classe (`[Authorize]`). Les actions sont encore
en squelette commenté dans le code — modèle cible ci-dessous.

```csharp
namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize]  // Toutes les routes nécessitent une authentification
public sealed class OrdersController(IDispatcher dispatcher) : ControllerBase
{
    // ── À venir (actuellement commentés dans le code) ───────────────────────────

    /// <summary>Passer une commande.</summary>
    // [HttpPost] → PlaceOrderCommand
    //   var id = await dispatcher.DispatchAsync(cmd, ct);
    //   return CreatedAtAction(nameof(GetById), new { id, version = "1.0" }, id);

    /// <summary>Mes commandes.</summary>
    // [HttpGet("my")] → GetMyOrdersQuery

    /// <summary>Détail d'une commande.</summary>
    // [HttpGet("{id:guid}")] → GetOrderByIdQuery

    /// <summary>Annuler une commande.</summary>
    // [HttpPost("{id:guid}/cancel")] → CancelOrderCommand
}
```

### `Controllers/BookingsController.cs`

Seul `available-slots` (public) est actif aujourd'hui ; les autres actions sont
commentées. La confirmation d'un créneau utilise la politique nommée `StaffOrAbove`.

```csharp
namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class BookingsController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Créneaux disponibles (public — pour afficher le calendrier).</summary>
    [HttpGet("available-slots")]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<AvailableSlotDto>>(200)]
    public async Task<IActionResult> GetAvailableSlots(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetAvailableSlotsQuery(from, to), ct));

    // ── À venir (actuellement commentés dans le code) ───────────────────────────
    // [HttpPost] [Authorize]                          → CreateBookingCommand
    // [HttpGet("my")] [Authorize]                     → GetMyBookingsQuery
    // [HttpPost("{id:guid}/confirm")] [Authorize(Policy = "StaffOrAbove")] → ConfirmBookingCommand
    // [HttpPost("{id:guid}/cancel")] [Authorize]      → CancelBookingCommand
}
```

### `Controllers/AuthController.cs`

Variante plus simple : route en dur `api/v1/[controller]` (pas le template versionné),
classe non-`sealed`, constructeur classique. Renvoie le `Result<AuthResponse>` du handler
en HTTP (`Ok`/`BadRequest`/`Unauthorized`). Voir **IDENTITY.md** pour les détails Identity.

```csharp
namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IDispatcher _dispatcher;

    public AuthController(IDispatcher dispatcher) => _dispatcher = dispatcher;

    /// <summary>Enregistre un nouvel utilisateur.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(
        [FromBody] RegisterCommand request, CancellationToken cancellationToken)
    {
        var result = await _dispatcher.DispatchAsync(request, cancellationToken);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    /// <summary>Connecte un utilisateur.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(
        [FromBody] LoginCommand request, CancellationToken cancellationToken)
    {
        var result = await _dispatcher.DispatchAsync(request, cancellationToken);
        return result.IsSuccess
            ? Ok(result.Value)
            : Unauthorized(new { error = result.Error });
    }

    /// <summary>Récupère l'utilisateur actuel.</summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult GetCurrentUser(
        [FromServices] ICurrentUserService currentUserService)
        => Ok(new
        {
            userId = currentUserService.UserId,
            email  = currentUserService.Email,
            roles  = currentUserService.Roles,
        });
}
```

---

## appsettings.json

```json
{
  "AllowedHosts": "*",
  "AllowedOrigins": "http://localhost:4200,https://localhost:4200,http://127.0.0.1:4200",

  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=True"
  },

  "Jwt": {
    "Key":      "REMPLACER_PAR_USER_SECRETS",
    "Issuer":   "AbrisAutoOutaouais.API",
    "Audience": "AbrisAutoOutaouais.CLIENT"
  },

  "Logging": {
    "LogLevel": {
      "Default":                                "Information",
      "Microsoft.AspNetCore":                    "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  }
}
```

## appsettings.Development.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default":                                "Debug",
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
    }
  }
}
```

---

## Récapitulatif — ce qui appartient (et n'appartient PAS) à Api

| ✅ Appartient à Api | ❌ N'appartient PAS à Api |
|--------------------|--------------------------|
| Controllers (minces) | Logique métier |
| Program.cs | Requêtes LINQ |
| GlobalExceptionHandler (`Middlewares/`) | Validateurs FluentValidation |
| appsettings.json | Accès DbContext direct |
| Pipeline middleware + versioning API | AppUser / Identity |
| Politiques d'auth (`[Authorize]` / `[AllowAnonymous]`) | DTOs Application |
