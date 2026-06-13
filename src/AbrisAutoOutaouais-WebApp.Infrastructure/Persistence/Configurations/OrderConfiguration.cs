using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);

        builder.Property(o => o.TotalAmount)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(o => o.Status)
            .HasConversion<string>()   // stocké comme string lisible en DB
            .HasMaxLength(20);

        builder.Property(o => o.DeliveryType)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(o => o.Notes)
            .HasMaxLength(500);

        // Owned Entity — snapshot de l'adresse au moment de la commande
        // Colonnes : ShippingAddress_Street, ShippingAddress_City, etc.
        builder.OwnsOne(o => o.ShippingAddress, addr =>
        {
            addr.Property(a => a.CivicNumber)
                .HasColumnName("ShippingAddress_CivicNumber").HasMaxLength(10);
            addr.Property(a => a.Apartment)
                .HasColumnName("ShippingAddress_Apartment").HasMaxLength(20);
            addr.Property(a => a.Street)
                .HasColumnName("ShippingAddress_Street").HasMaxLength(200);
            addr.Property(a => a.City)
                .HasColumnName("ShippingAddress_City").HasMaxLength(100);
            addr.Property(a => a.Province)
                .HasColumnName("ShippingAddress_Province").HasMaxLength(2);
            addr.Property(a => a.PostalCode)
                .HasColumnName("ShippingAddress_PostalCode").HasMaxLength(7);
            addr.Property(a => a.Country)
                .HasColumnName("ShippingAddress_Country").HasMaxLength(50);
        });

        // FK réelle vers AspNetUsers — possible grâce au DbContext unique
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);  // pas de cascade delete sur commandes

        // Soft delete — query filter global
        builder.HasQueryFilter(o => !o.IsDeleted);

        // Relations avec OrderLines
        builder.HasMany(o => o.Lines)
            .WithOne()
            .HasForeignKey(l => l.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
