using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Interface du DbContext d'application — injected dans les handlers.
/// </summary>
//public interface IApplicationDbContext
//{
//    DbSet<TEntity> Set<TEntity>() where TEntity : class;
//    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
//}


/// <summary>
/// Abstraction du DbContext — injectée directement dans les handlers CQRS.
/// Pas de Repository Pattern générique.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<Product> Products { get; }
    DbSet<ProductCategory> ProductCategories { get; }
    DbSet<ShelterModel> ShelterModels { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderLine> OrderLines { get; }
    DbSet<RentalContract> RentalContracts { get; }
    DbSet<BookingSlot> BookingSlots { get; }
    DbSet<WorkHoursEntry> WorkHoursEntries { get; }

    /// <summary>
    /// Accès générique à un <see cref="DbSet{TEntity}"/> — utilisé pour gérer explicitement une
    /// entité enfant qui n'a pas de DbSet dédié (ex. <c>ShelterModelDimension</c>, manipulée comme
    /// partie de l'agrégat <c>ShelterModel</c> : retrait + ajout des lignes lors d'une
    /// reconfiguration, robuste sur tous les fournisseurs EF — cf. UpdateShelterModelCommandHandler).
    /// </summary>
    DbSet<TEntity> Set<TEntity>() where TEntity : class;

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}