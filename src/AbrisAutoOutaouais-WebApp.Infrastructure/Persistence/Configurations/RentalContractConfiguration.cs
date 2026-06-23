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

        // ProductId NULLABLE : renseigné uniquement pour les contrats historiques (chemin produit).
        // Pas de FK mappée vers Product (snapshot — le contrat survit à la suppression du produit).
        builder.Property(r => r.ProductId);

        // Snapshot du modèle paramétrique loué + taille configurée (null pour les contrats historiques).
        builder.Property(r => r.ShelterModelSlug).HasMaxLength(80);
        builder.Property(r => r.ConfiguredLengthCm);
        builder.Property(r => r.ConfiguredClearHeightCm);

        // ── VOICI LA CORRECTION DE TON ERREUR ──
        // On explique à EF Core comment stocker le Value Object "Address" dans la table RentalContracts
        builder.OwnsOne(r => r.Address, addr =>
        {
            addr.Property(a => a.CivicNumber).HasColumnName("Address_CivicNumber").HasMaxLength(10);
            addr.Property(a => a.Apartment).HasColumnName("Address_Apartment").HasMaxLength(20);
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
