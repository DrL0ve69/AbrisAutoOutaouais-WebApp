using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

/// <summary>
/// Configuration EF du modèle d'abri paramétrique. Miroir de <see cref="ProductConfiguration"/> :
/// slug unique filtré (réutilisable après soft-delete), filtre de requête soft-delete, FK catégorie
/// en <c>Restrict</c>. Les collections <c>Dimensions</c> et <c>PriceEntries</c> sont des entités
/// RÉGULIÈRES (non owned : <c>HasMany</c>, cascade) → chargées via <c>.Include</c> explicite (L-035).
/// </summary>
internal sealed class ShelterModelConfiguration : IEntityTypeConfiguration<ShelterModel>
{
    public void Configure(EntityTypeBuilder<ShelterModel> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Slug).HasMaxLength(200).IsRequired();
        builder.Property(m => m.Name).HasMaxLength(200).IsRequired();
        // Plus de colonnes BasePrice/PricePerArchCents : le prix provient désormais de la grille
        // exacte (PriceEntries), pas d'une formule linéaire. Le « à partir de » est calculé
        // (StartingPriceCents = min de la grille) et n'est donc PAS persisté.

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

        // Grille de prix EXACTE — entité RÉGULIÈRE (cf. ShelterPriceEntryConfiguration), même patron
        // que Dimensions : FK ShelterModelId obligatoire en cascade, accès par champ via l'agrégat.
        builder.HasMany(m => m.PriceEntries)
            .WithOne()
            .HasForeignKey(e => e.ShelterModelId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(m => m.PriceEntries).Metadata.SetField("_priceEntries");
        builder.Navigation(m => m.PriceEntries).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasOne(m => m.Category)
            .WithMany()
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
