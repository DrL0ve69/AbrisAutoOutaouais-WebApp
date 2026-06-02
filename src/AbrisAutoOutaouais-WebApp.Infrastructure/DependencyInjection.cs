using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure;

/// <summary>
/// Extensions pour l'injection de dépendances de l'Infrastructure.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // DbContext
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection not found");

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseSqlServer(connectionString);
        });

        services.AddScoped<IApplicationDbContext>(provider =>
            provider.GetRequiredService<ApplicationDbContext>());

        // ASP.NET Core Identity
        services.AddIdentity<AppUser, AppRole>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireDigit = true;
                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedEmail = false;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        // Services Identity
        services.AddScoped<TokenService>();
        services.AddScoped<IIdentityService, IdentityService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // HTTP Context
        services.AddHttpContextAccessor();

        // JWT Authentication
        var jwtKey = configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key not configured");
        var jwtIssuer = configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("Jwt:Issuer not configured");
        var jwtAudience = configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("Jwt:Audience not configured");

        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtIssuer,
                    ValidateAudience = true,
                    ValidAudience = jwtAudience,
                    ValidateLifetime = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuerSigningKey = true,
                };
            });

        // Mediator
        services.AddScoped<IDispatcher, Dispatcher>();

        return services;
    }

    public static async Task<IServiceProvider> InitializeIdentityAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Appliquer les migrations
        await dbContext.Database.MigrateAsync();

        // Créer les rôles par défaut s'ils n'existent pas
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();

        var roles = new[] { "Admin", "Staff", "Customer" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new AppRole { Name = role, Description = $"Rôle {role}" });
            }
        }

        // Créer un utilisateur admin par défaut s'il n'existe pas
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var adminEmail = "admin@abristempo.local";
        if (await userManager.FindByEmailAsync(adminEmail) is null)
        {
            var adminUser = new AppUser
            {
                Email = adminEmail,
                UserName = adminEmail,
                FirstName = "Admin",
                LastName = "User",
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow,
            };

            var result = await userManager.CreateAsync(adminUser, "Admin@123456!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
        }

        return serviceProvider;
    }
}
