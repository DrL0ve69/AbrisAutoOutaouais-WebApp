using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetMyBookings;

public sealed record GetMyBookingsQuery() : IQuery<IReadOnlyList<BookingSummaryDto>>;
