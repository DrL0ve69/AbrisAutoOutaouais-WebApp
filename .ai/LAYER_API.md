# LAYER_API.md — Couche Api

Couche HTTP mince. Mappe les requêtes HTTP vers le Dispatcher et retourne le résultat.
**Aucune logique métier** dans les controllers.

---

## Règle d'or

Un controller ne fait que trois choses :
1. Recevoir la requête HTTP (binding automatique).
2. Dispatcher vers Application (`await dispatcher.Send(cmd, ct)`).
3. Retourner le résultat HTTP (`Ok(result)`, `Created(...)`, `NoContent()`).

Zéro `try/catch` — le `GlobalExceptionHandler` gère tout.

---

## Arborescence complète

```
src/Api/
├── Api.csproj
├── Program.cs                      ← composition root
├── appsettings.json
├── appsettings.Development.json    ← overrides dev (pas de secrets ici)
├── GlobalExceptionHandler.cs       ← mappe exceptions → RFC 9457 ProblemDetails
│
├── Controllers/
│   ├── ProductsController.cs       ← GET /products, GET /products/{slug}, POST, PUT, DELETE
│   ├── OrdersController.cs         ← POST /orders, GET /orders/my, GET /orders/{id}
│   ├── RentalsController.cs        ← POST /rentals, GET /rentals/my, DELETE /rentals/{id}
│   ├── BookingsController.cs       ← GET /bookings/available-slots, POST, GET /bookings/my
│   └── AuthController.cs           ← POST /auth/login, POST /auth/register, GET /auth/me, PUT /auth/me
│
└── wwwroot/
    └── uploads/
        └── products/               ← créer manuellement (mkdir -p wwwroot/uploads/products)
```

---

## Api.csproj

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <UserSecretsId>abristempo-api</UserSecretsId>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\Application\Application.csproj" />
    <ProjectReference Include="..\Infrastructure\Infrastructure.csproj" />
    <PackageReference Include="Asp.Versioning.Mvc"            Version="8.*" />
    <PackageReference Include="Microsoft.AspNetCore.OpenApi"   Version="10.*" />
  </ItemGroup>
</Project>
```

---

## Program.cs

```csharp
// src/Api/Program.cs
var builder = WebApplication.CreateBuilder(args);

// ── Infrastructure (DbContext, Identity, JWT, services) ───────────────────────
builder.Services.AddInfrastructure(builder.Configuration);

// ── Mediator Dispatcher ───────────────────────────────────────────────────────
builder.Services.AddScoped<Dispatcher>();

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

---

## GlobalExceptionHandler.cs

```csharp
namespace Api;

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

```csharp
namespace Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class ProductsController(Dispatcher dispatcher) : ControllerBase
{
    /// <summary>Liste paginée + filtres.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<PaginatedList<ProductSummaryDto>>(200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 12,
        [FromQuery] string? category = null, [FromQuery] string? search = null,
        CancellationToken ct = default)
        => Ok(await dispatcher.Query(new GetProductsQuery(page, pageSize, category, search), ct));

    /// <summary>Détail par slug (URL SEO-friendly).</summary>
    [HttpGet("{slug}")]
    [AllowAnonymous]
    [ProducesResponseType<ProductDto>(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
        => Ok(await dispatcher.Query(new GetProductBySlugQuery(slug), ct));

    /// <summary>Créer un produit.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType<Guid>(201)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Create(
        [FromBody] CreateProductCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.Send(cmd, ct);
        return CreatedAtAction(nameof(GetBySlug),
            new { slug = cmd.Slug, version = "1.0" }, id);
    }

    /// <summary>Mettre à jour un produit.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateProductCommand cmd, CancellationToken ct)
    {
        await dispatcher.Send(cmd with { Id = id }, ct);
        return NoContent();
    }

    /// <summary>Supprimer un produit (soft delete).</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await dispatcher.Send(new DeleteProductCommand(id), ct);
        return NoContent();
    }
}
```

### `Controllers/OrdersController.cs`

```csharp
namespace Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize]  // Toutes les routes nécessitent une authentification
public sealed class OrdersController(Dispatcher dispatcher) : ControllerBase
{
    /// <summary>Passer une commande.</summary>
    [HttpPost]
    [ProducesResponseType<Guid>(201)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> PlaceOrder(
        [FromBody] PlaceOrderCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.Send(cmd, ct);
        return CreatedAtAction(nameof(GetById), new { id, version = "1.0" }, id);
    }

    /// <summary>Mes commandes.</summary>
    [HttpGet("my")]
    [ProducesResponseType<IReadOnlyList<OrderSummaryDto>>(200)]
    public async Task<IActionResult> GetMy(CancellationToken ct)
        => Ok(await dispatcher.Query(new GetMyOrdersQuery(), ct));

    /// <summary>Détail d'une commande.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType<OrderDetailDto>(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => Ok(await dispatcher.Query(new GetOrderByIdQuery(id), ct));

    /// <summary>Annuler une commande.</summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await dispatcher.Send(new CancelOrderCommand(id), ct);
        return NoContent();
    }
}
```

### `Controllers/BookingsController.cs`

```csharp
namespace Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class BookingsController(Dispatcher dispatcher) : ControllerBase
{
    /// <summary>Créneaux disponibles (public — pour afficher le calendrier).</summary>
    [HttpGet("available-slots")]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<AvailableSlotDto>>(200)]
    public async Task<IActionResult> GetAvailableSlots(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await dispatcher.Query(new GetAvailableSlotsQuery(from, to), ct));

    /// <summary>Réserver un créneau.</summary>
    [HttpPost]
    [Authorize]
    [ProducesResponseType<Guid>(201)]
    [ProducesResponseType<ProblemDetails>(409)]
    public async Task<IActionResult> Create(
        [FromBody] CreateBookingCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.Send(cmd, ct);
        return CreatedAtAction(nameof(GetMy), new { version = "1.0" }, id);
    }

    /// <summary>Mes réservations.</summary>
    [HttpGet("my")]
    [Authorize]
    [ProducesResponseType<IReadOnlyList<BookingSummaryDto>>(200)]
    public async Task<IActionResult> GetMy(CancellationToken ct)
        => Ok(await dispatcher.Query(new GetMyBookingsQuery(), ct));

    /// <summary>Confirmer un créneau (Staff/Admin).</summary>
    [HttpPost("{id:guid}/confirm")]
    [Authorize(Policy = "StaffOrAbove")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Confirm(Guid id, CancellationToken ct)
    {
        await dispatcher.Send(new ConfirmBookingCommand(id), ct);
        return NoContent();
    }

    /// <summary>Annuler un créneau.</summary>
    [HttpPost("{id:guid}/cancel")]
    [Authorize]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await dispatcher.Send(new CancelBookingCommand(id), ct);
        return NoContent();
    }
}
```

### `Controllers/AuthController.cs`

Voir **IDENTITY.md** section 12 pour le code complet.

---

## appsettings.json

```json
{
  "AllowedHosts": "*",
  "AllowedOrigins": "http://localhost:4200",

  "ConnectionStrings": {
    "Default": "REMPLACER_PAR_USER_SECRETS"
  },

  "Jwt": {
    "Key":      "REMPLACER_PAR_USER_SECRETS",
    "Issuer":   "AbrisTempoLocal.Api",
    "Audience": "AbrisTempoLocal.Client"
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
| GlobalExceptionHandler | Validateurs FluentValidation |
| appsettings.json | Accès DbContext direct |
| wwwroot | AppUser / Identity |
| Middleware pipeline | DTOs Application |
