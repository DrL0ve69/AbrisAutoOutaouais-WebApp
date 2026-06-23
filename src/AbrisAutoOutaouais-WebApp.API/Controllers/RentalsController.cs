using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.AdminCancelRental;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CancelRental;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.ConfirmRentalPayment;
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
    /// <summary>
    /// Créer un contrat de location. Accessible aux visiteurs non connectés : ils fournissent un
    /// <c>GuestContact</c> qui crée/réutilise un compte express (parcours invité, Épic F). La réponse
    /// porte l'identifiant du contrat ET les instructions de paiement (virement Interac).
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(201)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Create([FromBody] CreateRentalContractCommand cmd, CancellationToken ct)
    {
        var result = await dispatcher.DispatchAsync(cmd, ct);
        // « id » reste exposé pour la compatibilité ; « payment » porte les instructions e-Transfer.
        return Created($"/api/v1/rentals/{result.RentalId}", new { id = result.RentalId, payment = result.Payment });
    }

    /// <summary>
    /// Réconcilier le paiement d'un contrat de location (Admin) : ACTIVE le contrat après réception
    /// du virement Interac correspondant à sa référence.
    /// </summary>
    [HttpPost("{id:guid}/confirm-payment")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> ConfirmPayment(Guid id, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new ConfirmRentalPaymentCommand(id), ct);
        return NoContent();
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
