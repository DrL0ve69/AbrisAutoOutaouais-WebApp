using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Intercepte les suppressions EF Core sur les entités ISoftDeletable.
/// Remplace EntityState.Deleted par IsDeleted=true + DeletedAt=UtcNow.
/// Le named query filter HasQueryFilter(e => !e.IsDeleted) exclut automatiquement
/// les entités supprimées de TOUTES les queries.
/// Pour voir les supprimés (admin) : .IgnoreQueryFilters().
/// </summary>
public sealed class SoftDeleteInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken ct = default)
    {
        if (eventData.Context is null)
            return base.SavingChangesAsync(eventData, result, ct);

        var entries = eventData.Context.ChangeTracker
            .Entries<ISoftDeletable>()
            .Where(e => e.State == EntityState.Deleted);

        foreach (var entry in entries)
        {
            entry.State = EntityState.Modified;
            entry.Entity.IsDeleted = true;
            entry.Entity.DeletedAt = DateTime.UtcNow;
        }

        return base.SavingChangesAsync(eventData, result, ct);
    }
}
