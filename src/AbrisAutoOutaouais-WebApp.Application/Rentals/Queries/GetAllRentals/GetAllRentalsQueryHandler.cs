using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Queries.GetAllRentals;

internal sealed class GetAllRentalsQueryHandler(
    IApplicationDbContext db,
    IIdentityService identity)
    : IQueryHandler<GetAllRentalsQuery, IReadOnlyList<AdminRentalDto>>
{
    public async Task<IReadOnlyList<AdminRentalDto>> HandleAsync(GetAllRentalsQuery query, CancellationToken ct)
    {
        var rows = await db.RentalContracts
            .AsNoTracking()
            .OrderByDescending(r => r.StartDate)
            .Select(r => new
            {
                r.Id,
                r.CustomerId,
                r.ProductName,
                r.MonthlyRate,
                r.StartDate,
                r.EndDate,
                r.Status,
                r.Address.CivicNumber,
                r.Address.Street,
                r.Address.City,
                r.CreatedAt,
            })
            .ToListAsync(ct);

        // Résolution des noms/courriels clients (peu de clients distincts en pratique).
        var profiles = new Dictionary<Guid, (string Name, string Email)>();
        foreach (var customerId in rows.Select(r => r.CustomerId).Distinct())
        {
            var profile = await identity.GetProfileAsync(customerId, ct);
            profiles[customerId] = profile is null
                ? ("—", "—")
                : ($"{profile.FirstName} {profile.LastName}".Trim(), profile.Email);
        }

        return rows
            .Select(r => new AdminRentalDto(
                r.Id,
                profiles[r.CustomerId].Name,
                profiles[r.CustomerId].Email,
                r.ProductName,
                r.MonthlyRate,
                r.StartDate,
                r.EndDate,
                r.Status.ToString(),
                $"{r.CivicNumber} {r.Street}, {r.City}",
                r.CreatedAt))
            .ToList();
    }

    public ValueTask<IReadOnlyList<AdminRentalDto>> Handle(GetAllRentalsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
