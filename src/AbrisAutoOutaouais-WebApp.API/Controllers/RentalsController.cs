using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.AdminCancelRental;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CancelRental;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetAllRentals;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetMyRentals;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize] // toutes les routes nécessitent une authentification
public sealed class RentalsController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Créer un contrat de location.</summary>
    [HttpPost]
    [ProducesResponseType(201)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Create([FromBody] CreateRentalContractCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.DispatchAsync(cmd, ct);
        return Created($"/api/v1/rentals/{id}", new { id });
    }

    /// <summary>Mes locations.</summary>
    [HttpGet("mine")]
    [ProducesResponseType<IReadOnlyList<RentalSummaryDto>>(200)]
    public async Task<IActionResult> GetMine(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetMyRentalsQuery(), ct));

    /// <summary>Annuler une de mes locations.</summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new CancelRentalCommand(id), ct);
        return NoContent();
    }

    // ── Administration ─────────────────────────────────────────────────────────

    /// <summary>Tous les contrats de location (Admin).</summary>
    [HttpGet("all")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType<IReadOnlyList<AdminRentalDto>>(200)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetAllRentalsQuery(), ct));

    /// <summary>
    /// Annuler n'importe quel contrat de location (Admin) — route distincte de
    /// POST {id}/cancel, qui reste réservée au propriétaire du contrat.
    /// </summary>
    [HttpPost("{id:guid}/admin-cancel")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> AdminCancel(Guid id, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new AdminCancelRentalCommand(id), ct);
        return NoContent();
    }
}
