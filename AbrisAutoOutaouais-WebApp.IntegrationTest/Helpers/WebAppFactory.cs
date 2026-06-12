using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.helpers;

/// <summary>
/// WebApplicationFactory remplace le vrai serveur et la vraie DB par des versions contrôlées.
/// Partage une seule instance entre tous les tests de la collection (performance).
/// </summary>
public sealed class WebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public HttpClient Client { get; private set; } = null!;

    /// <summary>
    /// Substitut PARTAGÉ du service courriel : la même instance est servie à chaque
    /// requête, ce qui permet aux tests de lire les appels reçus (ex. récupérer le
    /// lien de réinitialisation « envoyé »). Une fabrique par requête (lambda
    /// Substitute.For) rendrait les appels invérifiables.
    /// </summary>
    public IEmailService EmailService { get; } = Substitute.For<IEmailService>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remplacer le DbContext SQL Server par une DB InMemory.
            // EF Core ≥ 9 enregistre, par appel à AddDbContext, à la fois
            // DbContextOptions<T> ET un IDbContextOptionsConfiguration<T> qui porte le
            // « .UseSqlServer(...) » : ne retirer que DbContextOptions<T> laisse le
            // fournisseur SQL Server actif → « Only a single database provider can be
            // registered ». On retire donc toute la config liée au contexte avant de
            // réenregistrer. Astuce : « IDbContextOptionsConfiguration » contient lui-même
            // la sous-chaîne « DbContextOptions », d'où le filtre unique ci-dessous.
            var toRemove = services.Where(d =>
                d.ServiceType == typeof(ApplicationDbContext)
                || (d.ServiceType.FullName?.Contains("DbContextOptions", StringComparison.Ordinal) ?? false))
                .ToList();
            foreach (var d in toRemove)
                services.Remove(d);

            services.AddDbContext<ApplicationDbContext>(opts =>
                opts.UseInMemoryDatabase("IntegrationTestDb"));

            // Remplacer le service email par le substitut partagé (pas d'envoi réel,
            // et les tests peuvent inspecter les appels reçus via factory.EmailService).
            services.AddScoped<IEmailService>(_ => EmailService);
        });

        builder.UseEnvironment("Test");
    }

    public async Task InitializeAsync()
    {
        Client = CreateClient();

        // Seed initial via le seeder
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();

        await db.Database.EnsureCreatedAsync();
        await IdentitySeeder.SeedAsync(Services);
    }

    public new Task DisposeAsync() => Task.CompletedTask;
}
