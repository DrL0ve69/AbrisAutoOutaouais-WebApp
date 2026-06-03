using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;


namespace Infrastructure.Persistence.Configurations;

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(p => p.Slug)
            .HasMaxLength(200)
            .IsRequired();

        builder.HasIndex(p => p.Slug)
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");  // Index filtré — les slugs supprimés peuvent être réutilisés

        builder.Property(p => p.Price)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(p => p.RentalPrice)
            .HasColumnType("decimal(18,2)");

        builder.Property(p => p.Description)
            .HasMaxLength(2000);

        // Soft delete — query filter global
        builder.HasQueryFilter(p => !p.IsDeleted);

        // Index sur CategoryId (FK souvent filtrée)
        builder.HasIndex(p => p.CategoryId);

        // Owned collection d'images (table séparée)
        builder.OwnsMany(p => p.Images, img =>
        {
            img.WithOwner().HasForeignKey("ProductId");
            img.Property(i => i.Url).HasMaxLength(500).IsRequired();
            img.Property(i => i.AltText).HasMaxLength(200);
        });

        // Données de référence — catégories seedées ici, pas dans une migration
        builder.HasData(/* seed si nécessaire */);
    }

}