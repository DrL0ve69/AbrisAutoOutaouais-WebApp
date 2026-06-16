using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetShelterCatalog;

/// <summary>
/// Construit le catalogue marque → modèles. Le filtre (marque ET modèle non-null) et le tri
/// alphabétique sont poussés en SQL via <c>.AsNoTracking()</c> ; le regroupement par marque et
/// le dédoublonnage des modèles se font en mémoire après matérialisation — un <c>GroupBy</c>
/// imbriqué projetant une sous-liste ne se traduit pas en SQL, et le volume du catalogue est
/// petit. <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class GetShelterCatalogQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetShelterCatalogQuery, IReadOnlyList<BrandCatalogDto>>
{
    public async Task<IReadOnlyList<BrandCatalogDto>> HandleAsync(
        GetShelterCatalogQuery query, CancellationToken ct)
    {
        // Filtre + tri en SQL ; on ne ramène que les colonnes utiles (projection anonyme).
        // Tri marque → modèle → slug : le tie-break sur Slug rend le dédoublonnage déterministe.
        // Sans lui, deux produits de même marque+modèle mais slugs/dimensions différents
        // laisseraient le `First()` ci-dessous choisir une ligne au hasard renvoyée par SQL ;
        // avec lui, on retient TOUJOURS le slug alphabétiquement premier (cf. L-007 : l'invariant
        // qui rend la requête correcte doit être épinglé au plus près de la requête).
        var rows = await db.Products
            .AsNoTracking()
            .Where(p => p.Brand != null && p.Model != null)
            .OrderBy(p => p.Brand)
            .ThenBy(p => p.Model)
            .ThenBy(p => p.Slug)
            .Select(p => new
            {
                Brand = p.Brand!,
                Model = p.Model!,
                p.Slug,
                p.WidthCm,
                p.LengthCm,
                p.HeightCm,
            })
            .ToListAsync(ct);

        // Regroupement en mémoire : une entrée par marque, modèles distincts. Le `First()` est
        // déterministe grâce au tie-break `.ThenBy(Slug)` du SQL (slug premier dans l'ordre).
        return rows
            .GroupBy(r => r.Brand, StringComparer.Ordinal)
            .Select(g => new BrandCatalogDto(
                g.Key,
                g.GroupBy(r => r.Model, StringComparer.Ordinal)
                    .Select(m =>
                    {
                        var first = m.First();
                        return new ModelCatalogDto(
                            m.Key, first.Slug, first.WidthCm, first.LengthCm, first.HeightCm);
                    })
                    .ToList()))
            .ToList();
    }

    public ValueTask<IReadOnlyList<BrandCatalogDto>> Handle(
        GetShelterCatalogQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
