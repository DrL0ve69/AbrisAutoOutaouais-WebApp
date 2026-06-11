using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.CancelOrder;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;
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
    /// <summary>Passer une commande (persistée).</summary>
    [HttpPost]
    [ProducesResponseType(201)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.DispatchAsync(cmd, ct);
        return Created($"/api/v1/orders/{id}", new { id });
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
}
