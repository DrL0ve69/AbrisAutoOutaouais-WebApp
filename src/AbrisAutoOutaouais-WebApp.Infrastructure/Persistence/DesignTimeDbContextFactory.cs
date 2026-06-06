using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// Permet d'exécuter "dotnet ef migrations add" depuis le CLI
/// sans démarrer l'application complète.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseSqlServer(
            "Server=(localdb)\\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;");

        return new ApplicationDbContext(
            optionsBuilder.Options,
            new SoftDeleteInterceptor(),
            new AuditInterceptor(null!));  // null acceptable en design-time
    }
}
