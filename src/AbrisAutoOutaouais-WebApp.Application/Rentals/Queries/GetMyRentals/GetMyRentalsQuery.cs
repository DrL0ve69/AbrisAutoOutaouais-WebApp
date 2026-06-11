using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetMyRentals;

public sealed record GetMyRentalsQuery() : IQuery<IReadOnlyList<RentalSummaryDto>>;
