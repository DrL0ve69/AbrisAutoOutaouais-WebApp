using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Customers.Queries.SearchCustomers;
using AbrisAutoOutaouais_WebApp.Application.Planning.Commands.OptimizeRoute;
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

    /// <summary>
    /// Recherche de clients (rôle <c>Customer</c>) pour rattacher un RDV à un client existant
    /// depuis le calendrier admin (US-11.2). Réservé à l'Admin (saisie de RDV).
    /// </summary>
    [HttpGet("customers")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType<IReadOnlyList<CustomerSearchResultDto>>(200)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> SearchCustomers([FromQuery] string term, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new SearchCustomersQuery(term), ct));

    /// <summary>
    /// Optimise la tournée des RDV (Pending/Confirmed) d'une journée (US-11.3) : réordonne par plus
    /// proche voisin depuis la base de service et réécrit les heures sur la grille de créneaux.
    /// Réservé à l'Admin (validation visuelle du résultat).
    /// </summary>
    [HttpPost("optimize")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType<OptimizeRouteResultDto>(200)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> OptimizeRoute([FromQuery] DateOnly date, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new OptimizeRouteCommand(date), ct));

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
