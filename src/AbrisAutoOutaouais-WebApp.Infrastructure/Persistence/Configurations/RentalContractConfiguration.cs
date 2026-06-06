using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

public sealed class RentalContractConfiguration : IEntityTypeConfiguration<RentalContract>
{
    public void Configure(EntityTypeBuilder<RentalContract> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.ProductName).HasMaxLength(200).IsRequired();
        builder.Property(r => r.MonthlyRate).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);

        // ── VOICI LA CORRECTION DE TON ERREUR ──
        // On explique à EF Core comment stocker le Value Object "Address" dans la table RentalContracts
        builder.OwnsOne(r => r.Address, addr =>
        {
            addr.Property(a => a.Street).HasColumnName("Address_Street").HasMaxLength(200);
            addr.Property(a => a.City).HasColumnName("Address_City").HasMaxLength(100);
            addr.Property(a => a.Province).HasColumnName("Address_Province").HasMaxLength(2);
            addr.Property(a => a.PostalCode).HasColumnName("Address_PostalCode").HasMaxLength(7);
            addr.Property(a => a.Country).HasColumnName("Address_Country").HasMaxLength(50);
        });

        // Relation avec AppUser (le client qui loue)
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(r => r.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Soft delete — on exclut les contrats supprimés par défaut
        builder.HasQueryFilter(r => !r.IsDeleted);
    }
}
