using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.SetHourlyRate;

/// <summary>
/// Définit (ou retire si <see cref="HourlyRate"/> est <c>null</c>) le taux horaire CAD d'un employé
/// (rôle <c>Staff</c>) — EPIC 8, US-8.1, écriture Admin. Commande sans retour (<c>ICommand</c>).
/// </summary>
public sealed record SetHourlyRateCommand(Guid EmployeeId, decimal? HourlyRate) : ICommand;
