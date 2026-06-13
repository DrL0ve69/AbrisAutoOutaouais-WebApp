namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetAllRentals;

/// <summary>Contrat de location vu par l'administration (avec le nom et le courriel du client).</summary>
public sealed record AdminRentalDto(
    Guid Id,
    string CustomerName,
    string CustomerEmail,
    string ProductName,
    decimal MonthlyRate,
    DateOnly StartDate,
    DateOnly EndDate,
    string Status,
    string AddressSummary,
    DateTime CreatedAt);
