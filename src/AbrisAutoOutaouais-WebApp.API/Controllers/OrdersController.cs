using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize]  // Toutes les routes nécessitent une authentification
public sealed class OrdersController(Dispatcher dispatcher) : ControllerBase
{
    /// <summary>Passer une commande.</summary>
    //[HttpPost]
    //[ProducesResponseType<Guid>(201)]
    //[ProducesResponseType<ProblemDetails>(422)]
    //public async Task<IActionResult> PlaceOrder(
    //    [FromBody] PlaceOrderCommand cmd, CancellationToken ct)
    //{
    //    var id = await dispatcher.Send(cmd, ct);
    //    return CreatedAtAction(nameof(GetById), new { id, version = "1.0" }, id);
    //}

    /// <summary>Mes commandes.</summary>
    //[HttpGet("my")]
    //[ProducesResponseType<IReadOnlyList<OrderSummaryDto>>(200)]
    //public async Task<IActionResult> GetMy(CancellationToken ct)
    //    => Ok(await dispatcher.Query(new GetMyOrdersQuery(), ct));

    ///// <summary>Détail d'une commande.</summary>
    //[HttpGet("{id:guid}")]
    //[ProducesResponseType<OrderDetailDto>(200)]
    //[ProducesResponseType<ProblemDetails>(404)]
    //public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    //    => Ok(await dispatcher.Query(new GetOrderByIdQuery(id), ct));

    ///// <summary>Annuler une commande.</summary>
    //[HttpPost("{id:guid}/cancel")]
    //[ProducesResponseType(204)]
    //public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    //{
    //    await dispatcher.Send(new CancelOrderCommand(id), ct);
    //    return NoContent();
    //}
}
