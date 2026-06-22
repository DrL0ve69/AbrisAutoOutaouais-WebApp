using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.MarkPeriodPaid;

/// <summary>
/// Marque (ou dé-marque) la paie de toutes les journées d'un employé dans une fenêtre (EPIC 8). On
/// vérifie d'abord que l'employé est bien un membre du personnel (frontière : énumération canonique
/// via <see cref="IIdentityService.GetStaffWithRatesAsync"/>, pas d'accès direct à <c>AppUser</c>),
/// puis on charge les <see cref="WorkHoursEntry"/> SUIVIES (pas d'<c>AsNoTracking</c> : on mute) et on
/// applique la garde de transition du DOMAINE (<c>MarkPaid</c>/<c>MarkUnpaid</c>, idempotente) sur
/// chaque ligne — l'invariant de paie reste dans le domaine, jamais dupliqué ici (L-046).
/// </summary>
internal sealed class MarkPeriodPaidCommandHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : ICommandHandler<MarkPeriodPaidCommand, int>
{
    public async Task<int> HandleAsync(MarkPeriodPaidCommand command, CancellationToken ct)
    {
        var staff = await identity.GetStaffWithRatesAsync(ct);
        if (!staff.Any(s => s.Id == command.EmployeeId))
            throw new NotFoundException("Employé", command.EmployeeId);

        var entries = await db.WorkHoursEntries
            .Where(w => w.EmployeeId == command.EmployeeId
                && w.WorkDate >= command.From
                && w.WorkDate <= command.To)
            .ToListAsync(ct);

        foreach (var entry in entries)
        {
            if (command.Status == PayStatus.Payee)
                entry.MarkPaid();
            else
                entry.MarkUnpaid();
        }

        await db.SaveChangesAsync(ct);
        return entries.Count;
    }

    public ValueTask<int> Handle(MarkPeriodPaidCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
