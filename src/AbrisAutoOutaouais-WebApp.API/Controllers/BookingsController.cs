using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAvailableSlots;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class BookingsController(Dispatcher dispatcher) : ControllerBase
{
    /// <summary>Créneaux disponibles (public — pour afficher le calendrier).</summary>
    [HttpGet("available-slots")]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<AvailableSlotDto>>(200)]
    public async Task<IActionResult> GetAvailableSlots(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await dispatcher.Query(new GetAvailableSlotsQuery(from, to), ct));

    /// <summary>Réserver un créneau.</summary>
    //[HttpPost]
    //[Authorize]
    //[ProducesResponseType<Guid>(201)]
    //[ProducesResponseType<ProblemDetails>(409)]
    //public async Task<IActionResult> Create(
    //    [FromBody] CreateBookingCommand cmd, CancellationToken ct)
    //{
    //    var id = await dispatcher.Send(cmd, ct);
    //    return CreatedAtAction(nameof(GetMy), new { version = "1.0" }, id);
    //}

    ///// <summary>Mes réservations.</summary>
    //[HttpGet("my")]
    //[Authorize]
    //[ProducesResponseType<IReadOnlyList<BookingSummaryDto>>(200)]
    //public async Task<IActionResult> GetMy(CancellationToken ct)
    //    => Ok(await dispatcher.Query(new GetMyBookingsQuery(), ct));

    ///// <summary>Confirmer un créneau (Staff/Admin).</summary>
    //[HttpPost("{id:guid}/confirm")]
    //[Authorize(Policy = "StaffOrAbove")]
    //[ProducesResponseType(204)]
    //public async Task<IActionResult> Confirm(Guid id, CancellationToken ct)
    //{
    //    await dispatcher.Send(new ConfirmBookingCommand(id), ct);
    //    return NoContent();
    //}

    ///// <summary>Annuler un créneau.</summary>
    //[HttpPost("{id:guid}/cancel")]
    //[Authorize]
    //[ProducesResponseType(204)]
    //public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    //{
    //    await dispatcher.Send(new CancelBookingCommand(id), ct);
    //    return NoContent();
    //}
}
