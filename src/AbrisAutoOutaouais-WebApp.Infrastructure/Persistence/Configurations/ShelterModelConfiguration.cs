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

        // Collection des dimensions (largeurs + hauteurs dégagées) — entité RÉGULIÈRE (non owned)
        // avec sa propre clé Id (L-001) et une FK shadow ShelterModelId. On a renoncé à OwnsMany :
        // le fournisseur EF InMemory (tests/CI) ne sait pas ajouter/retirer des enfants OWNED d'un
        // parent déjà suivi (DbUpdateConcurrencyException au remplacement de la collection lors de
        // l'édition admin EPIC 9.5) ; une entité régulière supporte le CRUD complet de ses enfants
        // sur tous les fournisseurs. Le schéma de la table « ShelterModelDimension » (Id PK, Kind,
        // ValueCm, FK ShelterModelId en cascade) est INCHANGÉ — pas de migration de schéma requise.
        // Accès uniquement via l'agrégat ShelterModel (pas de DbSet exposé) → invariants préservés.
        builder.HasMany(m => m.Dimensions)
            .WithOne()
            .HasForeignKey("ShelterModelId")
            .IsRequired()  // FK obligatoire (comme l'owned) → ShelterModelId NON nullable, schéma identique
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(m => m.Dimensions).Metadata.SetField("_dimensions");
        builder.Navigation(m => m.Dimensions).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasOne(m => m.Category)
            .WithMany()
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
