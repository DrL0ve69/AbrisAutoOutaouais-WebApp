using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetAllRentals;

/// <summary>Tous les contrats de location (réservé à l'administration), du plus récent au plus ancien.</summary>
public sealed record GetAllRentalsQuery() : IQuery<IReadOnlyList<AdminRentalDto>>;
