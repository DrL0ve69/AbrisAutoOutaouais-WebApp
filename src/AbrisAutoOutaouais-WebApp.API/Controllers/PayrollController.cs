using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.MarkPeriodPaid;
using AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.SetHourlyRate;
using AbrisAutoOutaouais_WebApp.Application.Payroll.Queries.GetPayrollSummary;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

/// <summary>
/// Suivi de paie INFORMATIF (EPIC 8, US-8.1) — récap de masse salariale, édition du taux horaire et
/// marquage du statut de paie. Aucune déduction/taxe/virement n'est calculé. Réservé à l'Admin
/// (<c>AdminOnly</c> au niveau classe). Contrôleur thin : dispatch uniquement.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize(Policy = "AdminOnly")]
public sealed class PayrollController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Récap de paie agrégé par employé sur la fenêtre [from, to] (bornes incluses).</summary>
    [HttpGet("summary")]
    [ProducesResponseType<PayrollSummaryDto>(200)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetPayrollSummaryQuery(from, to), ct));

    /// <summary>Définit (ou retire si <c>hourlyRate</c> null) le taux horaire CAD d'un employé.</summary>
    [HttpPut("employees/{employeeId:guid}/rate")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> SetRate(
        Guid employeeId, [FromBody] SetRateRequest request, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new SetHourlyRateCommand(employeeId, request.HourlyRate), ct);
        return NoContent();
    }

    /// <summary>
    /// Bascule le statut de paie des journées d'un employé sur une fenêtre. Retourne le nombre de
    /// journées présentes dans la fenêtre (<c>{ updated }</c>).
    /// </summary>
    [HttpPut("mark-paid")]
    [ProducesResponseType(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> MarkPaid(
        [FromBody] MarkPeriodPaidCommand command, CancellationToken ct)
    {
        var updated = await dispatcher.DispatchAsync(command, ct);
        return Ok(new { updated });
    }
}

/// <summary>Corps de la requête d'édition du taux horaire (<c>null</c> = retirer le taux).</summary>
public sealed record SetRateRequest(decimal? HourlyRate);
