using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Infrastructure;
using AbrisAutoOutaouais_WebApp.Application;
using Asp.Versioning;
using AbrisAutoOutaouais_WebApp.API.Middlewares;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ── Infrastructure (DbContext, Identity, JWT, services) ───────────────────────
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

// ── Mediator Dispatcher ───────────────────────────────────────────────────────
builder.Services.AddScoped<IDispatcher, Dispatcher>();

// ── Contrôleurs ───────────────────────────────────────────────────────────────
// JsonStringEnumConverter : les enums (DeliveryType, OrderStatus…) circulent en chaînes
// lisibles ("Pickup", "Pending") plutôt qu'en entiers — plus simple côté Angular.
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddApiVersioning(opt =>
{
    opt.DefaultApiVersion = new ApiVersion(1, 0);
    opt.AssumeDefaultVersionWhenUnspecified = true;
    opt.ReportApiVersions = true;
});

// ── Exception Handler (RFC 9457 ProblemDetails) ───────────────────────────────
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opts => opts.AddPolicy("Frontend", policy =>
    policy.WithOrigins(builder.Configuration["AllowedOrigins"]!.Split(','))
          .AllowAnyHeader()
          .AllowAnyMethod()));

// ── Rate limiting (proxy Places) ──────────────────────────────────────────────
// Politique nommée « places » : fenêtre fixe de 30 requêtes / 10 s, partitionnée par IP
// cliente, qui protège le fournisseur d'adresses externe. Dépassement → 429.
builder.Services.AddRateLimiter(opts =>
{
    opts.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    opts.AddPolicy("places", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromSeconds(10),
                QueueLimit = 0,
            }));
});

// ── OpenAPI / Scalar avec support Bearer ──────────────────────────────────────
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Migrations EF au démarrage (opt-in — déploiement conteneurisé) ────────────
// Désactivé par défaut : dev et tests ne migrent JAMAIS via ce chemin (schéma géré
// par `dotnet ef database update`). Activé sur le conteneur prod
// (Database__MigrateOnStartup=true) → la révision se migre elle-même AVANT les
// seeders, sans étape de migration séparée. `MigrateAsync` prend un verrou
// applicatif SQL Server, donc sûr même si plusieurs réplicas démarrent ensemble.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider
        .GetRequiredService<ApplicationDbContext>()
        .Database.MigrateAsync();
}

// ── Seeders (rôles + compte admin, puis catalogue) ───────────────────────────
await IdentitySeeder.SeedAsync(app.Services);
await ProductSeeder.SeedAsync(app.Services);
await ShelterModelSeeder.SeedAsync(app.Services);  // référentiel modèles paramétriques (EPIC 9) — après les catégories

// ── Middleware pipeline ────────────────────────────────────────────────────────
// Ordre CRITIQUE — ne pas modifier
app.UseExceptionHandler();       // 1. Catch toutes les exceptions
// 2. HTTPS forcé en PRODUCTION seulement. En Développement on sert en http://localhost:5228 :
//    le SSR Angular (Node) et le navigateur évitent ainsi le rejet du certificat self-signed.
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseStaticFiles();            // 3. wwwroot (uploads)
app.UseCors("Frontend");         // 4. CORS avant auth
app.UseAuthentication();         // 5. Valide le JWT Bearer
app.UseAuthorization();          // 6. Applique [Authorize]
app.UseRateLimiter();            // 6.5 Limite de débit (politique « places ») avant le routage
app.MapControllers();            // 7. Route vers les controllers

if (app.Environment.IsDevelopment())
    app.MapOpenApi();            // Scalar UI en dev seulement

await app.RunAsync();

