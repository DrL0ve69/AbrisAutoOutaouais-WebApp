using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;

/// <summary>
/// Charge un modèle d'abri par slug puis le projette EN MÉMOIRE : les options de dimensions
/// (<c>WidthOptionsCm</c>/<c>ClearHeightOptionsCm</c>) sont calculées à partir de la collection
/// owned <c>Dimensions</c>, non traduisible en SQL — d'où le chargement de l'entité + projection
/// après matérialisation. La collection owned est chargée AUTOMATIQUEMENT par EF (ne pas
/// l'<c>Include</c> — EF lève sur un Include de navigation owned) ; seule la navigation
/// <c>Category</c> (régulière) est explicitement incluse. <c>AsNoTracking()</c> : lecture seule.
/// Slug inconnu → <see cref="NotFoundException"/> (mappé en 404). <c>HandleAsync</c> porte la
/// logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class GetShelterModelBySlugQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetShelterModelBySlugQuery, ShelterModelDetailDto>
{
    public async Task<ShelterModelDetailDto> HandleAsync(
        GetShelterModelBySlugQuery query, CancellationToken ct)
    {
        var model = await db.ShelterModels
            .AsNoTracking()
            .Include(m => m.Category)
            .FirstOrDefaultAsync(m => m.Slug == query.Slug, ct)
            ?? throw new NotFoundException(nameof(ShelterModel), query.Slug);

        return new ShelterModelDetailDto(
            model.Id,
            model.Slug,
            model.Name,
            model.Category.Name,
            model.BasePrice,
            model.MinLengthCm,
            model.MaxLengthCm,
            model.LengthStepCm,
            model.PricePerArchCents,
            model.WidthOptionsCm,
            model.ClearHeightOptionsCm);
    }

    public ValueTask<ShelterModelDetailDto> Handle(
        GetShelterModelBySlugQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
