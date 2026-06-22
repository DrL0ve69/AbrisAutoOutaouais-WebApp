using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModels;

/// <summary>
/// Projette la liste des modèles d'abris paramétriques. Filtre optionnel par slug de catégorie ;
/// tri <c>Name</c> puis <c>Slug</c> (tie-break déterministe — L-030). <c>AsNoTracking()</c> :
/// requête en lecture seule.
///
/// <c>BasePrice</c> (« à partir de ») est désormais le MINIMUM de la grille de prix exacte
/// (<c>PriceEntries</c>) et non une colonne stockée. <c>PriceEntries</c> est une entité RÉGULIÈRE →
/// <c>.Include</c> EXPLICITE requis (L-035) ; le min sur une collection enfant n'étant pas projeté
/// proprement par tous les fournisseurs, on MATÉRIALISE (avec la projection scalaire et le min de la
/// grille) AVANT de calculer en mémoire — on ne charge que les colonnes utiles via une projection
/// anonyme. <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class GetShelterModelsQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetShelterModelsQuery, IReadOnlyList<ShelterModelSummaryDto>>
{
    public async Task<IReadOnlyList<ShelterModelSummaryDto>> HandleAsync(
        GetShelterModelsQuery query, CancellationToken ct)
    {
        var models = db.ShelterModels.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.CategorySlug))
            models = models.Where(m => m.Category.Slug == query.CategorySlug);

        // Projection légère : on ne ramène que les scalaires + les prix (en cents) de la grille, pas
        // l'entité complète. Le min de la grille est calculé en mémoire (0 si grille vide).
        var rows = await models
            .OrderBy(m => m.Name)
            .ThenBy(m => m.Slug)
            .Select(m => new
            {
                m.Id,
                m.Slug,
                m.Name,
                CategoryName = m.Category.Name,
                m.MinLengthCm,
                m.MaxLengthCm,
                m.LengthStepCm,
                PriceCents = m.PriceEntries.Select(e => e.PriceCents).ToList(),
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new ShelterModelSummaryDto(
                r.Id,
                r.Slug,
                r.Name,
                r.CategoryName,
                r.PriceCents.Count == 0 ? 0m : r.PriceCents.Min() / 100m,
                r.MinLengthCm,
                r.MaxLengthCm,
                r.LengthStepCm))
            .ToList();
    }

    public ValueTask<IReadOnlyList<ShelterModelSummaryDto>> Handle(
        GetShelterModelsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
