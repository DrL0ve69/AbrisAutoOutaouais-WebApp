using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Commands.UpsertWorkHours;

/// <summary>
/// Upsert des heures travaillées par (employé, date) — US-11.2. Vérifie que l'employé est bien un
/// membre du personnel (<c>Staff</c>) via <see cref="IIdentityService.GetStaffMembersAsync"/> (la
/// couche Application ne référence jamais <c>AppUser</c>), puis crée ou met à jour la ligne
/// <see cref="WorkHoursEntry"/>. <c>WorkHoursEntry</c> est une entité RÉGULIÈRE autonome (et non un
/// owned-type) : on la manipule directement par son <c>DbSet</c> — robuste sur tous les fournisseurs
/// EF, y compris InMemory en test (L-035).
/// </summary>
internal sealed class UpsertWorkHoursCommandHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : ICommandHandler<UpsertWorkHoursCommand, Guid>
{
    public async Task<Guid> HandleAsync(UpsertWorkHoursCommand command, CancellationToken ct)
    {
        // L'employé visé doit appartenir au personnel (Staff). On valide via l'énumération canonique
        // des employés (frontière Application/Infrastructure) plutôt qu'un accès direct aux rôles.
        var staff = await identity.GetStaffMembersAsync(ct);
        if (!staff.Any(s => s.Id == command.EmployeeId))
            throw new NotFoundException("Employé", command.EmployeeId);

        var entry = await db.WorkHoursEntries
            .FirstOrDefaultAsync(w => w.EmployeeId == command.EmployeeId && w.WorkDate == command.Date, ct);

        if (entry is null)
        {
            entry = WorkHoursEntry.Create(
                command.EmployeeId, command.Date, command.StartMinutes, command.EndMinutes, command.Note);
            db.WorkHoursEntries.Add(entry);
        }
        else
        {
            entry.UpdateHours(command.StartMinutes, command.EndMinutes, command.Note);
        }

        await db.SaveChangesAsync(ct);
        return entry.Id;
    }

    public ValueTask<Guid> Handle(UpsertWorkHoursCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
