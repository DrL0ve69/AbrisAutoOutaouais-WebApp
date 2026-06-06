using AbrisAutoOutaouais_WebApp.Domain.Constants;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Seeder exécuté au démarrage de l'API pour s'assurer que les rôles métier 
/// et le compte administrateur par défaut existent en base de données.
/// </summary>
public static class IdentitySeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        // 1. Création d'un scope pour résoudre les services (car UserManager est Scoped)
        using var scope = services.CreateScope();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("IdentitySeeder");

        try
        {
            // 2. Création des rôles métier s'ils n'existent pas
            string[] roles = [Roles.Admin, Roles.Staff, Roles.Customer];

            foreach (var role in roles)
            {
                if (!await roleManager.RoleExistsAsync(role))
                {
                    await roleManager.CreateAsync(new AppRole(role));
                }
            }

            // 3. Création du compte Admin par défaut
            var adminEmail = "admin@abrisauto.com"; // Tu pourras changer ça plus tard
            var adminUser = await userManager.FindByEmailAsync(adminEmail);

            if (adminUser is null)
            {
                adminUser = new AppUser
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    FirstName = "Admin",
                    LastName = "Système",
                    EmailConfirmed = true, // Important pour pouvoir se connecter
                    PreferredLanguage = "fr"
                };

                // Création avec un mot de passe fort temporaire
                var result = await userManager.CreateAsync(adminUser, "Admin123!");

                if (result.Succeeded)
                {
                    // Assigner le rôle Admin
                    await userManager.AddToRoleAsync(adminUser, Roles.Admin);
                    logger.LogInformation("Compte admin par défaut créé avec succès.");
                }
                else
                {
                    var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                    logger.LogError("Échec de la création de l'admin: {Errors}", errors);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Une erreur grave est survenue lors de l'initialisation de la base de données (Seeding).");
            throw;
        }
    }
}
