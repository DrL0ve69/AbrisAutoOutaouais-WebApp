using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence.Configurations;

/// <summary>
/// Configuration EF de <see cref="WorkHoursEntry"/> — entité RÉGULIÈRE autonome (sa propre table),
/// JAMAIS un owned-type d'agrégat (L-035). FK vers <c>AppUser</c> en <c>Restrict</c> (on ne supprime
/// pas en cascade les heures d'un employé). Index UNIQUE sur (EmployeeId, WorkDate) : au plus une
/// ligne par couple employé/jour (clé d'upsert). Soft-delete via filtre de requête global.
/// </summary>
internal sealed class WorkHoursEntryConfiguration : IEntityTypeConfiguration<WorkHoursEntry>
{
    public void Configure(EntityTypeBuilder<WorkHoursEntry> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Note).HasMaxLength(500);

        // Statut de paie persisté en string (idiome RentalContract.Status) — défaut « À payer ».
        builder.Property(w => w.PayStatus)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(PayStatus.AnsPayer);

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(w => w.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Un seul enregistrement d'heures par employé et par jour (clé métier d'upsert).
        // Filtre [IsDeleted] = 0 apparié au filtre de requête global de soft-delete ci-dessous :
        // une ligne soft-deletée libère son créneau d'index, donc une future commande de suppression
        // ne pourra pas faire échouer la ré-insertion des heures pour le même employé/jour.
        builder.HasIndex(w => new { w.EmployeeId, w.WorkDate }).IsUnique().HasFilter("[IsDeleted] = 0");

        builder.HasQueryFilter(w => !w.IsDeleted);
    }
}
