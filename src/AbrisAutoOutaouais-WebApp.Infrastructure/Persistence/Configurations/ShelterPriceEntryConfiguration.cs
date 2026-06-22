using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

/// <summary>
/// Configuration EF d'une entrée de la GRILLE DE PRIX EXACTE (<see cref="ShelterPriceEntry"/>).
/// Calquée sur la collection <c>Dimensions</c> de <see cref="ShelterModelConfiguration"/> : entité
/// RÉGULIÈRE (non owned) avec sa propre clé Id (L-001), FK <c>ShelterModelId</c> obligatoire en
/// CASCADE — supprimer un modèle supprime sa grille. Le mapping HasMany/WithOne vit dans
/// <see cref="ShelterModelConfiguration"/> (côté agrégat) ; ici on configure les colonnes et l'index.
///
/// Index UNIQUE sur (ShelterModelId, LengthCm, ClearHeightCm) : la grille a au plus UN prix par
/// combinaison (lookup déterministe <see cref="ShelterModel.PriceFor"/>). PAS de <c>HasFilter</c>
/// soft-delete : <see cref="ShelterPriceEntry"/> n'est PAS <c>ISoftDeletable</c> (pas plus que
/// <see cref="ShelterModelDimension"/>) — le piège L-045 ne s'applique qu'aux entités soft-delete.
/// </summary>
internal sealed class ShelterPriceEntryConfiguration : IEntityTypeConfiguration<ShelterPriceEntry>
{
    public void Configure(EntityTypeBuilder<ShelterPriceEntry> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.LengthCm).IsRequired();
        builder.Property(e => e.ClearHeightCm).IsRequired();
        builder.Property(e => e.PriceCents).IsRequired();

        // Unicité de la combinaison (modèle × longueur × hauteur). Entité NON soft-deletable → pas
        // de filtre d'index (cf. en-tête : L-045 ne concerne que les entités ISoftDeletable).
        builder.HasIndex(e => new { e.ShelterModelId, e.LengthCm, e.ClearHeightCm })
            .IsUnique();
    }
}
