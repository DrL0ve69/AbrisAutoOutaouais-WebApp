using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModels;

/// <summary>
/// Projette la liste des modèles d'abris paramétriques. Filtre optionnel par slug de catégorie ;
/// tri <c>Name</c> puis <c>Slug</c> (tie-break déterministe — L-030). <c>AsNoTracking()</c> :
/// requête en lecture seule. La projection ne lit que des colonnes scalaires (pas les owned
/// dimensions), donc elle est entièrement traduisible en SQL. <c>HandleAsync</c> porte la logique ;
/// <c>Handle</c> satisfait l'interface et délègue — même patron que les autres handlers du projet.
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

        return await models
            .OrderBy(m => m.Name)
            .ThenBy(m => m.Slug)
            .Select(m => new ShelterModelSummaryDto(
                m.Id,
                m.Slug,
                m.Name,
                m.Category.Name,
                m.BasePrice,
                m.MinLengthCm,
                m.MaxLengthCm,
                m.LengthStepCm))
            .ToListAsync(ct);
    }

    public ValueTask<IReadOnlyList<ShelterModelSummaryDto>> Handle(
        GetShelterModelsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
