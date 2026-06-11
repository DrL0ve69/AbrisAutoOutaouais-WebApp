using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Infrastructure;
using AbrisAutoOutaouais_WebApp.Application;
using Asp.Versioning;
using AbrisAutoOutaouais_WebApp.API.Middlewares;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ── Infrastructure (DbContext, Identity, JWT, services) ───────────────────────
builder.Services.AddInfrastructure(builder.Configuration);

// ── Mediator Dispatcher ───────────────────────────────────────────────────────
builder.Services.AddScoped<IDispatcher, Dispatcher>();

// ── Contrôleurs ───────────────────────────────────────────────────────────────
builder.Services.AddControllers();
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

// ── OpenAPI / Scalar avec support Bearer ──────────────────────────────────────
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Seeders (rôles + compte admin, puis catalogue) ───────────────────────────
await IdentitySeeder.SeedAsync(app.Services);
await ProductSeeder.SeedAsync(app.Services);

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

