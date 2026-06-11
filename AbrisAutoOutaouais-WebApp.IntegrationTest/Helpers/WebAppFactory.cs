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
using System.Text;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.helpers;

/// <summary>
/// WebApplicationFactory remplace le vrai serveur et la vraie DB par des versions contrôlées.
/// Partage une seule instance entre tous les tests de la collection (performance).
/// </summary>
public sealed class WebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public HttpClient Client { get; private set; } = null!;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remplacer le DbContext SQL Server par une DB InMemory
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor is not null)
                services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(opts =>
                opts.UseInMemoryDatabase("IntegrationTestDb"));

            // Remplacer le service email par un mock (pas d'envoi réel)
            services.AddScoped<IEmailService>(_ => Substitute.For<IEmailService>());
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
