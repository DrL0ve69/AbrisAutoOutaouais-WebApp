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

        // ProductId est optionnel : nul pour une ligne d'abri configuré (EPIC 9.4).
        builder.Property(ol => ol.ProductId)
            .IsRequired(false);

        // Snapshot d'abri configuré (paramétrique) — nuls pour une ligne produit classique.
        builder.Property(ol => ol.ShelterModelSlug)
            .HasMaxLength(200);

        builder.Property(ol => ol.ConfiguredLengthCm);

        // Indexation des clés étrangères pour optimiser les performances des requêtes (Joins)
        builder.HasIndex(ol => ol.OrderId);

        // Index filtré : seules les lignes produit (ProductId non nul) sont indexées — les lignes
        // d'abri configuré n'ont pas de ProductId et ne polluent donc pas l'index.
        builder.HasIndex(ol => ol.ProductId)
            .HasFilter("[ProductId] IS NOT NULL");
    }
}
