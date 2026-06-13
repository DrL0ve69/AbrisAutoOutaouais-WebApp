using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity.Configurations;

/// <summary>
/// Configure les colonnes supplémentaires de AppUser dans AspNetUsers.
/// base.OnModelCreating() dans ApplicationDbContext configure déjà les colonnes Identity standard.
/// </summary>
internal sealed class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.Property(u => u.FirstName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.LastName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.Avatar)
            .HasMaxLength(500);

        builder.Property(u => u.PreferredLanguage)
            .HasMaxLength(2)
            .IsRequired()
            .HasDefaultValue("fr");

        // Owned Entity — Address de Domain.ValueObjects
        // Stockée dans AspNetUsers avec colonnes préfixées "DefaultAddress_"
        builder.OwnsOne(u => u.DefaultDeliveryAddress, addr =>
        {
            addr.Property(a => a.CivicNumber)
                .HasColumnName("DefaultAddress_CivicNumber").HasMaxLength(10);
            addr.Property(a => a.Apartment)
                .HasColumnName("DefaultAddress_Apartment").HasMaxLength(20);
            addr.Property(a => a.Street)
                .HasColumnName("DefaultAddress_Street").HasMaxLength(200);
            addr.Property(a => a.City)
                .HasColumnName("DefaultAddress_City").HasMaxLength(100);
            addr.Property(a => a.Province)
                .HasColumnName("DefaultAddress_Province").HasMaxLength(2).HasDefaultValue("QC");
            addr.Property(a => a.PostalCode)
                .HasColumnName("DefaultAddress_PostalCode").HasMaxLength(7);
            addr.Property(a => a.Country)
                .HasColumnName("DefaultAddress_Country").HasMaxLength(50).HasDefaultValue("Canada");
        });
    }
}
