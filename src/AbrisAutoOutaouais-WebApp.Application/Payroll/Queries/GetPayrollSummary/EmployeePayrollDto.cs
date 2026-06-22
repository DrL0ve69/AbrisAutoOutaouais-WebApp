using AbrisAutoOutaouais_WebApp.Domain.Enums;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Queries.GetPayrollSummary;

/// <summary>
/// Récap de paie INFORMATIF d'un employé pour une fenêtre de dates (EPIC 8, US-8.1).
/// </summary>
/// <param name="EmployeeId">Identifiant de l'employé (rôle Staff).</param>
/// <param name="FullName">Nom complet affiché.</param>
/// <param name="HourlyRate">Taux horaire CAD, ou <c>null</c> si non défini (afficher « — »).</param>
/// <param name="TotalMinutes">
/// Somme des (EndMinutes − StartMinutes) sur les lignes où LES DEUX bornes existent.
/// </param>
/// <param name="Amount">
/// Montant brut = (TotalMinutes / 60) × HourlyRate. <c>null</c> si le taux est <c>null</c> (jamais 0) —
/// distingue « taux non défini » de « 0 $ ». Aucun calcul de déduction/taxe.
/// </param>
/// <param name="PayStatus">
/// <see cref="Domain.Enums.PayStatus.Payee"/> SSI TOUTES les lignes de la fenêtre sont payées ;
/// sinon <see cref="Domain.Enums.PayStatus.AnsPayer"/>.
/// </param>
/// <param name="EntryCount">Nombre de journées saisies dans la fenêtre.</param>
/// <param name="UnpaidCount">Nombre de journées encore « À payer ».</param>
public sealed record EmployeePayrollDto(
    Guid EmployeeId,
    string FullName,
    decimal? HourlyRate,
    int TotalMinutes,
    decimal? Amount,
    PayStatus PayStatus,
    int EntryCount,
    int UnpaidCount);
