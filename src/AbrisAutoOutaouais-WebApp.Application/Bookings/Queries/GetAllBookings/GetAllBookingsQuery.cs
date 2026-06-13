using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAllBookings;

/// <summary>Toutes les réservations (réservé à l'administration), du créneau le plus récent au plus ancien.</summary>
public sealed record GetAllBookingsQuery() : IQuery<IReadOnlyList<AdminBookingDto>>;
