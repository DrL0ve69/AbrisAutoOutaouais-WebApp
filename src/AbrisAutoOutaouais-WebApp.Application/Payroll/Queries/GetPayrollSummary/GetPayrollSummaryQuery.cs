using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Queries.GetPayrollSummary;

/// <summary>
/// Récap de paie INFORMATIF agrégé par employé sur la fenêtre [<see cref="From"/>, <see cref="To"/>]
/// (bornes incluses), EPIC 8 / US-8.1. Lecture pure réservée à l'Admin.
/// </summary>
public sealed record GetPayrollSummaryQuery(DateOnly From, DateOnly To) : IQuery<PayrollSummaryDto>;
