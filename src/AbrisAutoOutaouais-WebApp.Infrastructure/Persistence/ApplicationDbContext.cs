using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// DbContext unique pour l'application — combine ASP.NET Core Identity + entités métier.
/// Hérite de IdentityDbContext&lt;AppUser, AppRole, Guid&gt; pour avoir toutes les tables Identity.
/// </summary>
public sealed class ApplicationDbContext : IdentityDbContext<AppUser, AppRole, Guid>, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Configuration de AppUser
        builder.Entity<AppUser>(entity =>
        {
            entity.ToTable("AspNetUsers");

            // Owned Entity — DeliveryAddress est stockée dans AspNetUsers avec le préfixe "DefaultDeliveryAddress_"
            entity.OwnsOne(u => u.DefaultDeliveryAddress, navBuilder =>
            {
                navBuilder.Property(a => a.Street).HasColumnName("DefaultDeliveryAddress_Street");
                navBuilder.Property(a => a.City).HasColumnName("DefaultDeliveryAddress_City");
                navBuilder.Property(a => a.Province).HasColumnName("DefaultDeliveryAddress_Province");
                navBuilder.Property(a => a.PostalCode).HasColumnName("DefaultDeliveryAddress_PostalCode");
                navBuilder.Property(a => a.Country).HasColumnName("DefaultDeliveryAddress_Country");
            });

            entity.Property(u => u.FirstName).IsRequired();
            entity.Property(u => u.LastName).IsRequired();
            entity.Property(u => u.PreferredLanguage).HasDefaultValue("fr");
            entity.Property(u => u.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // Configuration de AppRole
        builder.Entity<AppRole>(entity =>
        {
            entity.ToTable("AspNetRoles");
            entity.Property(r => r.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // Renommer les tables Identity
        builder.Entity<AppUser>().ToTable("AspNetUsers");
        builder.Entity<AppRole>().ToTable("AspNetRoles");
    }

    /// <summary>
    /// Override SaveChangesAsync pour appliquer les audit trails, soft deletes, etc.
    /// </summary>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // TODO: Ajouter les behaviors (audit, soft delete, etc.) ici si nécessaire
        return await base.SaveChangesAsync(cancellationToken);
    }
}
