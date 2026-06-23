using AbrisAutoOutaouais_WebApp.Application;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Interceptors;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services;
using AbrisAutoOutaouais_WebApp.Application.Common.Services;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services.Payments;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services.Places;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure;

/// <summary>
/// Extensions pour l'injection de dépendances de l'Infrastructure.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config, IHostEnvironment environment)
    {
        // ── DbContext unique (Identity + domaine) ─────────────────────────────
        services.AddDbContext<ApplicationDbContext>(opts =>
            opts.UseSqlServer(config.GetConnectionString("DefaultConnection")!,
                sql => sql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

        services.AddScoped<IApplicationDbContext>(
            sp => sp.GetRequiredService<ApplicationDbContext>());

        // ── Interceptors (Singleton car ils n'ont pas d'état mutable) ─────────
        services.AddSingleton<SoftDeleteInterceptor>();
        services.AddScoped<AuditInterceptor>();   // Scoped car dépend de ICurrentUserService

        // ── ASP.NET Core Identity ─────────────────────────────────────────────
        services
            .AddIdentity<AppUser, AppRole>(opts =>
            {
                opts.Password.RequiredLength = 8;
                opts.Password.RequireDigit = true;
                opts.Password.RequireLowercase = true;
                opts.Password.RequireUppercase = true;
                opts.Password.RequireNonAlphanumeric = true;
                opts.User.RequireUniqueEmail = true;
                opts.Lockout.MaxFailedAccessAttempts = 5;
                opts.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
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
                opts.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(opts =>
            {
                opts.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(
                                                  Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuer = true,
                    ValidIssuer = config["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = config["Jwt:Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
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
            .AddPolicy("AdminOnly", p => p.RequireRole(Roles.Admin));

        // ── Services Identity ─────────────────────────────────────────────────
        services.AddScoped<TokenService>();
        services.AddScoped<IIdentityService, IdentityService>();
        services.AddScoped<IExpressAccountService, ExpressAccountService>();

        // ── Services métier ───────────────────────────────────────────────────
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<IFileStorageService, LocalFileStorageService>();

        // EmailService est un STUB de développement : il journalise les courriels
        // au lieu de les envoyer. En Production, ses LogInformation sont filtrés
        // (niveau Warning par défaut) → l'utilisateur reçoit 202 mais AUCUN
        // courriel, en silence. On préfère un Warning de démarrage TONITRUANT à un
        // crash (un vrai déploiement peut légitimement remplacer ce service), mais
        // l'absence d'un vrai fournisseur ne doit pas pouvoir passer inaperçue.
        if (environment.IsProduction())
        {
            using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
            loggerFactory.CreateLogger("AbrisAutoOutaouais.Infrastructure.Email").LogWarning(
                "ATTENTION : EmailService est le STUB de développement (journalisation, " +
                "aucun envoi réel). Brancher un fournisseur SMTP/SendGrid/SES avant la mise " +
                "en production, sinon les courriels (réinitialisation, confirmations) sont " +
                "silencieusement perdus.");
        }

        services.AddScoped<IEmailService, EmailService>();
        // Instance EAGER : une clé « Client:BaseUrl » absente fait échouer le
        // démarrage (même idiome fail-fast que « Jwt:Key » ci-dessus), plutôt
        // que la première demande de réinitialisation.
        services.AddSingleton<IClientUrlProvider>(new ClientUrlProvider(config));

        // ── Proxy Places (autocomplétion d'adresse) ───────────────────────────
        // Premier AddHttpClient TYPÉ du dépôt. Le fournisseur est choisi par config
        // (« Places:Provider ») : permuter Photon → Radar → Google se fait sans toucher au
        // code (changer la clé + le provider). La BaseAddress est épinglée ici depuis la
        // config et n'est jamais concaténée depuis une entrée utilisateur (cf. les services).
        services.AddOptions<PlacesOptions>().Bind(config.GetSection("Places"));
        var placesOptions = config.GetSection("Places").Get<PlacesOptions>() ?? new PlacesOptions();
        switch (placesOptions.Provider?.Trim().ToLowerInvariant())
        {
            case "radar":
                services.AddHttpClient<IPlacesService, RadarPlacesService>(
                    c => c.BaseAddress = new Uri(placesOptions.Radar.BaseUrl));
                break;
            case "google":
                services.AddHttpClient<IPlacesService, GooglePlacesService>(
                    c => c.BaseAddress = new Uri(placesOptions.Google.BaseUrl));
                break;
            default: // « photon » par défaut (sans clé)
                services.AddHttpClient<IPlacesService, PhotonPlacesService>(
                    c => c.BaseAddress = new Uri(placesOptions.Photon.BaseUrl));
                break;
        }

        // ── Paiement (virement Interac manuel par défaut) ─────────────────────
        // Même idiome que Places : le fournisseur est choisi par config (« Payments:Provider ») ;
        // permuter manual → VoPay → Paysafe se fait sans toucher au code. Le défaut « manual » est
        // SANS clé et SANS appel réseau (voie gratuite — règle budget) : pas de HttpClient.
        //
        // VoPay / Paysafe (sous-tâche 7.4) sont des STUBS KEYLESS d'extensibilité (patron
        // Strategy/OCP, miroir de Google/Radar pour Places) : jamais le défaut, et protégés par une
        // GARDE FAIL-FAST AU DÉMARRAGE — sélectionner l'un d'eux sans clé fait échouer le démarrage
        // (même idiome que « Jwt:Key » / « Client:BaseUrl » ci-dessus). C'est l'UNIQUE point
        // d'enforcement de l'invariant budget « pas d'adaptateur payant activé par accident » (L-046) :
        // l'activation réelle exige clé + contrat marchand payant + accord explicite du propriétaire.
        services.AddOptions<PaymentsOptions>().Bind(config.GetSection("Payments"));
        services.AddSingleton<IPaymentReferenceGenerator, Base32PaymentReferenceGenerator>();
        var paymentsOptions = config.GetSection("Payments").Get<PaymentsOptions>() ?? new PaymentsOptions();
        switch (paymentsOptions.Provider?.Trim().ToLowerInvariant())
        {
            case "vopay":
                if (string.IsNullOrWhiteSpace(paymentsOptions.VoPay.ApiKey))
                    throw new InvalidOperationException(
                        "Adaptateur de paiement VoPay sélectionné mais non activé : il exige une clé " +
                        "API (« Payments:VoPay:ApiKey »), un contrat marchand payant et l'accord " +
                        "explicite du propriétaire (règle budget). Défaut = « manual ».");
                services.AddScoped<IPaymentService, VoPayPaymentService>();
                break;
            case "paysafe":
                if (string.IsNullOrWhiteSpace(paymentsOptions.Paysafe.ApiKey))
                    throw new InvalidOperationException(
                        "Adaptateur de paiement Paysafe sélectionné mais non activé : il exige une clé " +
                        "API (« Payments:Paysafe:ApiKey »), un contrat marchand payant et l'accord " +
                        "explicite du propriétaire (règle budget). Défaut = « manual ».");
                services.AddScoped<IPaymentService, PaysafePaymentService>();
                break;
            default: // « manual » par défaut (virement Interac sans clé, sans réseau)
                services.AddScoped<IPaymentService, ManualInteracPaymentService>();
                break;
        }

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
