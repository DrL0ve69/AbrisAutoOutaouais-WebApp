namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Queries.GetPayrollSummary;

/// <summary>
/// Récap agrégé de la masse salariale INFORMATIVE pour une fenêtre de dates (EPIC 8, US-8.1).
/// <see cref="TotalPayroll"/> = somme des <see cref="EmployeePayrollDto.Amount"/> non-null
/// (les employés sans taux ne contribuent pas au total).
/// </summary>
public sealed record PayrollSummaryDto(
    DateOnly From,
    DateOnly To,
    IReadOnlyList<EmployeePayrollDto> Employees,
    decimal TotalPayroll);
