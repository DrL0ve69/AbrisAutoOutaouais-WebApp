using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.SuggestShelters;

/// <summary>
/// Retient les produits dont les dimensions sont renseignées ET couvrent les dimensions
/// requises, triés du plus petit suffisant (empreinte au sol croissante) au plus grand,
/// avec tie-break sur le nom pour un ordre stable. <c>HandleAsync</c> porte la logique
/// (appelé par le Dispatcher) ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class SuggestSheltersQueryHandler(IApplicationDbContext db)
    : IQueryHandler<SuggestSheltersQuery, IReadOnlyList<ShelterSuggestionDto>>
{
    public async Task<IReadOnlyList<ShelterSuggestionDto>> HandleAsync(
        SuggestSheltersQuery query, CancellationToken ct)
    {
        // AsNoTracking() obligatoire sur les queries. Le filtre garantit des dimensions
        // non-null ET ≥ requis : les marges projetées sont donc toujours ≥ 0, et le « ! »
        // (null-forgiving) dans le tri est sûr. Marges/IsTightFit sont des scalaires int →
        // l'expression se traduit en SQL sans matérialisation préalable.
        return await db.Products
            .AsNoTracking()
            .Where(p =>
                p.WidthCm != null && p.LengthCm != null
                && p.WidthCm >= query.RequiredWidthCm
                && p.LengthCm >= query.RequiredLengthCm)
            .OrderBy(p => p.WidthCm!.Value * p.LengthCm!.Value)
            .ThenBy(p => p.Name)
            .Select(p => new ShelterSuggestionDto(
                p.Id,
                p.Name,
                p.Slug,
                p.Price,
                p.RentalPrice,
                p.Category.Name,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.WidthCm!.Value,
                p.LengthCm!.Value,
                p.HeightCm,
                p.WidthCm!.Value - query.RequiredWidthCm,
                p.LengthCm!.Value - query.RequiredLengthCm,
                p.WidthCm!.Value - query.RequiredWidthCm < ProductDimensions.TightFitMarginCm
                    || p.LengthCm!.Value - query.RequiredLengthCm < ProductDimensions.TightFitMarginCm,
                p.Brand,
                p.Model))
            .ToListAsync(ct);
    }

    public ValueTask<IReadOnlyList<ShelterSuggestionDto>> Handle(
        SuggestSheltersQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
