using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

/// <summary>
/// Configuration EF du modèle d'abri paramétrique. Miroir de <see cref="ProductConfiguration"/> :
/// slug unique filtré (réutilisable après soft-delete), filtre de requête soft-delete, FK catégorie
/// en <c>Restrict</c>. La collection <c>Dimensions</c> est owned (<c>OwnsMany</c>, comme les images
/// du produit) avec sa propre clé identifiante (Id Guid — cf. L-001).
/// </summary>
internal sealed class ShelterModelConfiguration : IEntityTypeConfiguration<ShelterModel>
{
    public void Configure(EntityTypeBuilder<ShelterModel> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Slug).HasMaxLength(200).IsRequired();
        builder.Property(m => m.Name).HasMaxLength(200).IsRequired();
        builder.Property(m => m.BasePrice).HasColumnType("decimal(18,2)").IsRequired();

        // Index unique filtré — un slug soft-deleted peut être réutilisé (comme Product).
        builder.HasIndex(m => m.Slug)
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");

        builder.HasQueryFilter(m => !m.IsDeleted);

        // Collection owned des dimensions (largeurs + hauteurs dégagées) — clé propre Id (L-001).
        builder.OwnsMany(m => m.Dimensions, dim =>
        {
            dim.HasKey(d => d.Id);
            dim.WithOwner().HasForeignKey("ShelterModelId");
            dim.Property(d => d.Kind).IsRequired();
            dim.Property(d => d.ValueCm).IsRequired();
        });

        builder.HasOne(m => m.Category)
            .WithMany()
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
