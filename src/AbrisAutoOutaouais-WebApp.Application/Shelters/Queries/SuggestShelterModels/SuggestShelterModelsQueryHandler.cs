using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.SuggestShelterModels;

/// <summary>
/// Suggère les modèles d'abris compatibles avec une empreinte mesurée (EPIC 10, US-10.1).
///
/// On MATÉRIALISE d'abord les modèles (avec <c>Dimensions</c> + <c>Category</c>) AVANT toute
/// projection : <c>WidthOptionsCm</c> et la logique de bornage (<see cref="ShelterFitCalculator"/>)
/// ne sont PAS traduisibles en SQL (calcul en mémoire sur la collection — pièges L-035/L-038 ;
/// aucun <c>.Contains</c> non traduisible). <c>Dimensions</c> est une entité RÉGULIÈRE → elle doit
/// être <c>Include</c> explicitement, tout comme <c>Category</c>. <c>AsNoTracking()</c> : lecture.
///
/// INVARIANT « une largeur = un modèle » (post-EPIC 9) : chaque modèle n'a qu'UNE largeur, donc sa
/// largeur de comparaison = la 1re (et seule) valeur de <c>WidthOptionsCm</c>.
///
/// Tri DÉTERMINISTE (L-030) : catégories par nom puis slug ; modèles par largeur puis slug.
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class SuggestShelterModelsQueryHandler(IApplicationDbContext db)
    : IQueryHandler<SuggestShelterModelsQuery, IReadOnlyList<ShelterFitResultDto>>
{
    public async Task<IReadOnlyList<ShelterFitResultDto>> HandleAsync(
        SuggestShelterModelsQuery query, CancellationToken ct)
    {
        var models = await db.ShelterModels
            .AsNoTracking()
            .Include(m => m.Dimensions)
            .Include(m => m.PriceEntries)   // « à partir de » = min de la grille (entité régulière, L-035)
            .Include(m => m.Category)
            .ToListAsync(ct);

        // Projection EN MÉMOIRE : un modèle est retenu s'il rentre en largeur ET a ≥ 1 longueur
        // admissible. On ne garde que les modèles utiles, déjà annotés de leurs longueurs.
        var fitted = models
            .Select(m =>
            {
                // « une largeur = un modèle » : une seule valeur attendue. Garde explicite : un modèle
                // sans largeur (donnée malformée) est ignoré plutôt que de faire planter tout /suggest.
                if (m.WidthOptionsCm.Count == 0)
                    return null;
                var widthCm = m.WidthOptionsCm[0];
                if (!ShelterFitCalculator.Fits(widthCm, query.RequiredWidthCm))
                    return null;

                var lengths = ShelterFitCalculator.AvailableLengths(
                    m.MinLengthCm, m.LengthStepCm, m.MaxLengthCm, query.RequiredLengthCm);
                if (lengths.Count == 0)
                    return null;

                // « À partir de » en dollars : min de la grille de prix (0 si grille vide).
                var basePrice = m.StartingPrice;

                return new
                {
                    m.Category.Slug,
                    CategoryName = m.Category.Name,
                    Model = new ShelterFitModelDto(
                        m.Id, m.Slug, m.Name, widthCm, basePrice,
                        m.MinLengthCm, m.LengthStepCm, lengths),
                };
            })
            .Where(x => x is not null)
            .Select(x => x!)
            .ToList();

        return fitted
            .GroupBy(x => new { x.Slug, x.CategoryName })
            .Select(g => new ShelterFitResultDto(
                g.Key.Slug,
                g.Key.CategoryName,
                g.Max(x => x.Model.WidthCm),
                g.Select(x => x.Model)
                    .OrderBy(m => m.WidthCm)
                    .ThenBy(m => m.Slug)
                    .ToList()))
            .OrderBy(r => r.CategoryName)
            .ThenBy(r => r.CategorySlug)
            .ToList();
    }

    public ValueTask<IReadOnlyList<ShelterFitResultDto>> Handle(
        SuggestShelterModelsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
