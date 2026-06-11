namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetMyRentals;

/// <summary>Résumé d'un contrat de location pour la liste « Mes locations ».</summary>
public sealed record RentalSummaryDto(
    Guid Id,
    string ProductName,
    decimal MonthlyRate,
    DateOnly StartDate,
    DateOnly EndDate,
    string Status);
