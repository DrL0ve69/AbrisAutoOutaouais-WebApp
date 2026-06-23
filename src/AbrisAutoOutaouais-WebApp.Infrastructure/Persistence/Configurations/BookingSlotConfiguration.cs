using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

internal sealed class BookingSlotConfiguration : IEntityTypeConfiguration<BookingSlot>
{
    public void Configure(EntityTypeBuilder<BookingSlot> builder)
    {
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(b => b.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(b => b.Notes).HasMaxLength(500);
        builder.Property(b => b.Brand).HasMaxLength(100);
        builder.Property(b => b.Model).HasMaxLength(100);

        // Coordonnées géocodées à la création (US-11.3) — nullable, sans index ni précision spéciale.
        builder.Property(b => b.Lat);
        builder.Property(b => b.Lng);

        // Montant forfaitaire facturé (snapshot) — decimal(18,2), symétrie Order.Total / MonthlyRate (EPIC 7.3).
        builder.Property(b => b.Amount).HasColumnType("decimal(18,2)");

        // Owned VO — information de paiement (virement Interac) portée par l'agrégat (PAS d'entité
        // Payment). OwnsOne (et non OwnsMany) → round-trip sûr sur InMemory comme sur SQL Server (L-035).
        // Colonnes : Payment_Reference, Payment_ConfirmedAt. PAS d'index unique sur la référence pour le
        // MVP ; si on en ajoute un un jour sur cet agrégat ISoftDeletable → HasFilter (L-045).
        // Calque RentalContractConfiguration.
        builder.OwnsOne(b => b.Payment, pay =>
        {
            pay.Property(p => p.Reference)
                .HasColumnName("Payment_Reference").HasMaxLength(40);
            pay.Property(p => p.ConfirmedAt)
                .HasColumnName("Payment_ConfirmedAt");
        });

        builder.OwnsOne(b => b.Address, addr =>
        {
            addr.Property(a => a.CivicNumber).HasColumnName("Address_CivicNumber").HasMaxLength(10);
            addr.Property(a => a.Apartment).HasColumnName("Address_Apartment").HasMaxLength(20);
            addr.Property(a => a.Street).HasColumnName("Address_Street").HasMaxLength(200);
            addr.Property(a => a.City).HasColumnName("Address_City").HasMaxLength(100);
            addr.Property(a => a.Province).HasColumnName("Address_Province").HasMaxLength(2);
            addr.Property(a => a.PostalCode).HasColumnName("Address_PostalCode").HasMaxLength(7);
            addr.Property(a => a.Country).HasColumnName("Address_Country").HasMaxLength(50);
        });

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(b => b.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Index pour vérifier les conflits de créneaux efficacement
        builder.HasIndex(b => new { b.SlotStart, b.Status });

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}
