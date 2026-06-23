using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.CancelOrder;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.ConfirmPayment;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.UpdateOrderStatus;
using AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetAllOrders;
using AbrisAutoOutaouais_WebApp.Application.Orders.Queries.GetMyOrders;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize] // toutes les routes nécessitent une authentification
public sealed class OrdersController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>
    /// Passer une commande (persistée). Accessible aux visiteurs non connectés : ils fournissent
    /// un <c>GuestContact</c> qui crée/réutilise un compte express (parcours invité, Épic F). La réponse
    /// porte l'identifiant de la commande ET les instructions de paiement (virement Interac).
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(201)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderCommand cmd, CancellationToken ct)
    {
        var result = await dispatcher.DispatchAsync(cmd, ct);
        // « id » reste exposé pour la compatibilité ; « payment » porte les instructions e-Transfer.
        return Created($"/api/v1/orders/{result.OrderId}", new { id = result.OrderId, payment = result.Payment });
    }

    /// <summary>
    /// Réconcilier le paiement d'une commande (Admin) : marque la commande comme PAYÉE après réception
    /// du virement Interac correspondant à sa référence.
    /// </summary>
    [HttpPost("{id:guid}/confirm-payment")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> ConfirmPayment(Guid id, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new ConfirmOrderPaymentCommand(id), ct);
        return NoContent();
    }

    /// <summary>Mes commandes.</summary>
    [HttpGet("mine")]
    [ProducesResponseType<IReadOnlyList<OrderSummaryDto>>(200)]
    public async Task<IActionResult> GetMine(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetMyOrdersQuery(), ct));

    /// <summary>Annuler une de mes commandes.</summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new CancelOrderCommand(id), ct);
        return NoContent();
    }

    // ── Administration ─────────────────────────────────────────────────────────

    /// <summary>Toutes les commandes (Admin).</summary>
    [HttpGet("all")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType<IReadOnlyList<AdminOrderDto>>(200)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetAllOrdersQuery(), ct));

    /// <summary>Faire avancer le statut d'une commande (Admin) : confirm / ship / deliver / cancel.</summary>
    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> UpdateStatus(
        Guid id, [FromBody] UpdateOrderStatusRequest body, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new UpdateOrderStatusCommand(id, body.Action), ct);
        return NoContent();
    }
}
