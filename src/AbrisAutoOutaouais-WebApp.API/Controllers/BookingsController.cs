using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CancelBooking;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAvailableSlots;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetMyBookings;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize] // toutes les routes nécessitent une authentification sauf indication contraire
public sealed class BookingsController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Créneaux disponibles (public — pour afficher le calendrier).</summary>
    [HttpGet("available-slots")]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<AvailableSlotDto>>(200)]
    public async Task<IActionResult> GetAvailableSlots(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetAvailableSlotsQuery(from, to), ct));

    /// <summary>Réserver un créneau.</summary>
    [HttpPost]
    [ProducesResponseType(201)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Create([FromBody] CreateBookingCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.DispatchAsync(cmd, ct);
        return Created($"/api/v1/bookings/{id}", new { id });
    }

    /// <summary>Mes réservations.</summary>
    [HttpGet("mine")]
    [ProducesResponseType<IReadOnlyList<BookingSummaryDto>>(200)]
    public async Task<IActionResult> GetMine(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetMyBookingsQuery(), ct));

    /// <summary>Annuler une de mes réservations.</summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new CancelBookingCommand(id), ct);
        return NoContent();
    }
}
