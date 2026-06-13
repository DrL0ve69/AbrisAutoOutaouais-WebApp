using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CancelBooking;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.RescheduleBooking;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.UpdateBookingStatus;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAllBookings;
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

    /// <summary>Reporter une de mes réservations sur un autre créneau.</summary>
    [HttpPost("{id:guid}/reschedule")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Reschedule(
        Guid id, [FromBody] RescheduleBookingRequest body, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new RescheduleBookingCommand(id, body.NewSlotStart), ct);
        return NoContent();
    }

    // ── Administration ─────────────────────────────────────────────────────────

    /// <summary>Toutes les réservations (Admin).</summary>
    [HttpGet("all")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType<IReadOnlyList<AdminBookingDto>>(200)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetAllBookingsQuery(), ct));

    /// <summary>Faire avancer le statut d'une réservation (Admin) : confirm / complete / cancel.</summary>
    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> UpdateStatus(
        Guid id, [FromBody] UpdateBookingStatusRequest body, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new UpdateBookingStatusCommand(id, body.Action), ct);
        return NoContent();
    }
}
