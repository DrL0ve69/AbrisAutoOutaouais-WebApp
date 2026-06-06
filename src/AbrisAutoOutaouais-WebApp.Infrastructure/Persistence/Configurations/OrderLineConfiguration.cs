using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

public sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> builder)
    {
        builder.HasKey(ol => ol.Id);

        builder.Property(ol => ol.ProductName)
            .HasMaxLength(200)
            .IsRequired();

        // Précision cruciale pour les montants monétaires en SQL Server
        builder.Property(ol => ol.UnitPrice)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(ol => ol.LineTotal)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(ol => ol.Quantity)
            .IsRequired();

        // Indexation des clés étrangères pour optimiser les performances des requêtes (Joins)
        builder.HasIndex(ol => ol.OrderId);
        builder.HasIndex(ol => ol.ProductId);
    }
}
