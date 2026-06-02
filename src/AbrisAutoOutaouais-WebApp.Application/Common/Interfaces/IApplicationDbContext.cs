using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Interface du DbContext d'application — injected dans les handlers.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<TEntity> Set<TEntity>() where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
