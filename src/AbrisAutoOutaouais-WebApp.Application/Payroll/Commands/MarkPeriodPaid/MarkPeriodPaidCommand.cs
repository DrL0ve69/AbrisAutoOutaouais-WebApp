using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Enums;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.MarkPeriodPaid;

/// <summary>
/// Bascule le statut de paie de TOUTES les journées d'un employé dans la fenêtre [<see cref="From"/>,
/// <see cref="To"/>] (bornes incluses) vers <see cref="Status"/> — EPIC 8, US-8.1, écriture Admin.
/// Retourne le nombre de lignes effectivement présentes dans la fenêtre. INFORMATIF uniquement.
/// </summary>
public sealed record MarkPeriodPaidCommand(
    Guid EmployeeId,
    DateOnly From,
    DateOnly To,
    PayStatus Status) : ICommand<int>;
