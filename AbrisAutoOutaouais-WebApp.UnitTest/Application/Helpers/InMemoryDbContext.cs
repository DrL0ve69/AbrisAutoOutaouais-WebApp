using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Interceptors;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;

/// <summary>
/// Factory pour créer un ApplicationDbContext en mémoire pour les tests.
/// Chaque test reçoit une instance isolée avec un nom unique.
/// </summary>
public static class TestDbContextFactory
{
    public static ApplicationDbContext Create()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()) // Isolation par test
            .Options;

        // Interceptors minimaux pour les tests
        var softDelete = new SoftDeleteInterceptor();
        var audit = new AuditInterceptor(null);  // null = pas de currentUser en test

        var context = new ApplicationDbContext(options, softDelete, audit);
        context.Database.EnsureCreated();
        return context;
    }
}
