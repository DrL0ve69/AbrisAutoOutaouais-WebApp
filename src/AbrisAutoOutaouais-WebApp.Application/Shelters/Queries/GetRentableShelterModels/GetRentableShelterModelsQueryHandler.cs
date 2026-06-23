using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetRentableShelterModels;

/// <summary>
/// Projette les modèles d'abris LOUABLES (<c>MonthlyRentalCents != null</c>) en
/// <see cref="RentableShelterModelDto"/>. Les options de dimensions (<c>WidthOptionsCm</c>/
/// <c>ClearHeightOptionsCm</c>) sont calculées à partir de la collection <c>Dimensions</c>, non
/// traduisible en SQL — d'où le chargement de l'entité (<c>.Include</c> explicite des entités
/// RÉGULIÈRES <c>Dimensions</c>/<c>PriceEntries</c>/<c>Category</c>, L-035) puis projection en mémoire.
/// <c>AsNoTracking()</c> : lecture seule. Tri <c>Name</c> puis <c>Slug</c> (tie-break déterministe, L-030).
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class GetRentableShelterModelsQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetRentableShelterModelsQuery, IReadOnlyList<RentableShelterModelDto>>
{
    public async Task<IReadOnlyList<RentableShelterModelDto>> HandleAsync(
        GetRentableShelterModelsQuery query, CancellationToken ct)
    {
        var models = await db.ShelterModels
            .AsNoTracking()
            .Include(m => m.Category)
            .Include(m => m.Dimensions)
            .Include(m => m.PriceEntries)
            .Where(m => m.MonthlyRentalCents != null)
            .OrderBy(m => m.Name)
            .ThenBy(m => m.Slug)
            .ToListAsync(ct);

        return models
            .Select(m => new RentableShelterModelDto(
                m.Slug,
                m.Name,
                m.Category.Name,
                // Non nul garanti par le filtre MonthlyRentalCents != null ci-dessus.
                m.MonthlyRentalPrice!.Value,
                m.MinLengthCm,
                m.MaxLengthCm,
                m.LengthStepCm,
                // Une largeur = un modèle (rework EPIC 9) : on expose la (seule) largeur du modèle.
                m.WidthOptionsCm.Count == 0 ? 0 : m.WidthOptionsCm[0],
                m.ClearHeightOptionsCm,
                m.PriceEntries
                    .OrderBy(e => e.LengthCm)
                    .ThenBy(e => e.ClearHeightCm)
                    .Select(e => new ShelterPriceGridEntryDto(e.LengthCm, e.ClearHeightCm, e.PriceCents))
                    .ToList()))
            .ToList();
    }

    public ValueTask<IReadOnlyList<RentableShelterModelDto>> Handle(
        GetRentableShelterModelsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
