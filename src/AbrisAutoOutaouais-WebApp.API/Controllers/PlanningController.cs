using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Planning.Commands.UpsertWorkHours;
using AbrisAutoOutaouais_WebApp.Application.Planning.Queries.GetDayDetail;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

/// <summary>
/// Planning (US-11.2) : détail d'une journée (RDV + heures des employés) et saisie des heures.
/// Lecture réservée à <c>StaffOrAbove</c> (Admin et Staff voient tout) ; écriture des heures
/// réservée à <c>AdminOnly</c>.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize]
public sealed class PlanningController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Détail d'une journée : RDV du jour + tous les employés avec leurs heures.</summary>
    [HttpGet("day")]
    [Authorize(Policy = "StaffOrAbove")]
    [ProducesResponseType<DayDetailDto>(200)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> GetDay([FromQuery] DateOnly date, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetDayDetailQuery(date), ct));

    /// <summary>Crée ou met à jour les heures d'un employé pour une date (Admin).</summary>
    [HttpPut("work-hours")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> UpsertWorkHours(
        [FromBody] UpsertWorkHoursCommand command, CancellationToken ct)
    {
        var id = await dispatcher.DispatchAsync(command, ct);
        return Ok(new { id });
    }
}
