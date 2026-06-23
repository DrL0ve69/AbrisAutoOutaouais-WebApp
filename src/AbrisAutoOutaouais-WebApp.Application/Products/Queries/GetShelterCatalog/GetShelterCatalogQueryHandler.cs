using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetShelterCatalog;

/// <summary>
/// Construit le catalogue marque → modèles à partir du RÉFÉRENTIEL des modèles d'abris PARAMÉTRIQUES
/// (<see cref="ShelterModel"/>, EPIC 9) — et non plus des <c>Product</c> fixes, désormais retirés du
/// catalogue. Tous les modèles sont de la marque unique « Abris Tempo ». Les dimensions exposées sont
/// REPRÉSENTATIVES (largeur unique du modèle, longueur de base, hauteur dégagée minimale) : elles ne
/// servent qu'à informer les listes déroulantes du formulaire d'installation. La forme de sortie
/// (<see cref="BrandCatalogDto"/>/<see cref="ModelCatalogDto"/>) est INCHANGÉE — le frontend n'est
/// pas touché. Les dimensions vivant dans une collection enfant RÉGULIÈRE, on charge
/// <c>.Include(m =&gt; m.Dimensions)</c> explicitement (L-035). Tri par nom puis slug pour un ordre
/// déterministe (L-030). <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface.
/// </summary>
public sealed class GetShelterCatalogQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetShelterCatalogQuery, IReadOnlyList<BrandCatalogDto>>
{
    /// <summary>Marque unique sous laquelle tous les modèles paramétriques sont regroupés.</summary>
    private const string BrandName = "Abris Tempo";

    public async Task<IReadOnlyList<BrandCatalogDto>> HandleAsync(
        GetShelterCatalogQuery query, CancellationToken ct)
    {
        // Modèles paramétriques actifs (filtre soft-delete par défaut), avec leurs dimensions
        // chargées explicitement (entité enfant RÉGULIÈRE → .Include requis, sinon WidthOptionsCm/
        // ClearHeightOptionsCm ressortiraient vides, L-035). Tri nom → slug : déterministe (L-030).
        var models = await db.ShelterModels
            .AsNoTracking()
            .Include(m => m.Dimensions)
            .OrderBy(m => m.Name)
            .ThenBy(m => m.Slug)
            .ToListAsync(ct);

        // Une entrée par modèle, sous la marque unique « Abris Tempo ». Dimensions REPRÉSENTATIVES :
        // largeur unique (une largeur = un modèle post-EPIC 9), longueur de base (MinLengthCm),
        // hauteur dégagée minimale — pour information dans le formulaire d'installation seulement.
        var catalogModels = models
            .Select(m => new ModelCatalogDto(
                m.Name,
                m.Slug,
                m.WidthOptionsCm.Count > 0 ? m.WidthOptionsCm[0] : null,
                m.MinLengthCm,
                m.ClearHeightOptionsCm.Count > 0 ? m.ClearHeightOptionsCm[0] : null))
            .ToList();

        // Aucun modèle → liste vide (pas une marque vide), comme l'ancien comportement « 0 produit ».
        return catalogModels.Count == 0
            ? []
            : [new BrandCatalogDto(BrandName, catalogModels)];
    }

    public ValueTask<IReadOnlyList<BrandCatalogDto>> Handle(
        GetShelterCatalogQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
