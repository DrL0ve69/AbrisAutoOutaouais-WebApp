using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

public sealed class ProductCategoryConfiguration : IEntityTypeConfiguration<ProductCategory>
{
    public void Configure(EntityTypeBuilder<ProductCategory> builder)
    {
        builder.HasKey(pc => pc.Id);

        builder.Property(pc => pc.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(pc => pc.Slug)
            .HasMaxLength(150)
            .IsRequired();

        // Un slug doit toujours être unique pour éviter les conflits de routes de navigation
        builder.HasIndex(pc => pc.Slug)
            .IsUnique();

        // Configuration optionnelle des longueurs pour l'audit
        builder.Property(pc => pc.CreatedBy).HasMaxLength(100);
        builder.Property(pc => pc.UpdatedBy).HasMaxLength(100);
    }
}
