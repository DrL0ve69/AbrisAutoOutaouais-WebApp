using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Queries.GetPayrollSummary;

/// <summary>
/// Assemble le récap de paie INFORMATIF (EPIC 8, US-8.1) : pour CHAQUE employé (Staff), agrège ses
/// <see cref="WorkHoursEntry"/> dont la <c>WorkDate</c> tombe dans [From, To] (bornes incluses), puis
/// joint sur le taux horaire via <see cref="IIdentityService.GetStaffWithRatesAsync"/> (la couche
/// Application ne référence jamais <c>AppUser</c>). Tous les employés Staff figurent au récap, même
/// sans heures saisies (montants nuls). Lecture pure (<c>.AsNoTracking()</c>).
/// </summary>
internal sealed class GetPayrollSummaryQueryHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : IQueryHandler<GetPayrollSummaryQuery, PayrollSummaryDto>
{
    public async Task<PayrollSummaryDto> HandleAsync(GetPayrollSummaryQuery query, CancellationToken ct)
    {
        // Matérialiser AVANT d'agréger en mémoire : l'agrégation par employé et le calcul de durée
        // (bornes nullables) ne se traduisent pas proprement en SQL ; on charge la fenêtre puis on
        // groupe côté client (L-038 : pas de .Contains/GroupBy SQL piégeux).
        var entries = await db.WorkHoursEntries
            .AsNoTracking()
            .Where(w => w.WorkDate >= query.From && w.WorkDate <= query.To)
            .ToListAsync(ct);

        var byEmployee = entries
            .GroupBy(w => w.EmployeeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Tous les employés Staff + leur taux (frontière Application/Infrastructure).
        var staff = await identity.GetStaffWithRatesAsync(ct);

        var employees = new List<EmployeePayrollDto>(staff.Count);
        decimal total = 0m;

        foreach (var member in staff)
        {
            var lines = byEmployee.TryGetValue(member.Id, out var l) ? l : [];

            // Total des minutes : uniquement les journées où LES DEUX bornes existent.
            var totalMinutes = lines
                .Where(w => w.StartMinutes is not null && w.EndMinutes is not null)
                .Sum(w => w.EndMinutes!.Value - w.StartMinutes!.Value);

            // Montant : (minutes / 60) × taux. null si taux non défini (jamais 0) — distingue
            // « taux non défini » de « 0 $ » ; seuls les montants non-null alimentent le total.
            decimal? amount = member.HourlyRate is { } rate
                ? totalMinutes / 60m * rate
                : null;
            if (amount is { } a) total += a;

            var unpaidCount = lines.Count(w => w.PayStatus == PayStatus.AnsPayer);

            // Payée SSI au moins une ligne existe ET toutes sont payées ; sinon « À payer ».
            var status = lines.Count > 0 && unpaidCount == 0
                ? PayStatus.Payee
                : PayStatus.AnsPayer;

            employees.Add(new EmployeePayrollDto(
                member.Id,
                member.FullName,
                member.HourlyRate,
                totalMinutes,
                amount,
                status,
                lines.Count,
                unpaidCount));
        }

        return new PayrollSummaryDto(query.From, query.To, employees, total);
    }

    public ValueTask<PayrollSummaryDto> Handle(GetPayrollSummaryQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
