using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;

/// <summary>
/// Charge un modèle d'abri par slug puis le projette EN MÉMOIRE : les options de dimensions
/// (<c>WidthOptionsCm</c>/<c>ClearHeightOptionsCm</c>) sont calculées à partir de la collection
/// <c>Dimensions</c>, non traduisible en SQL — d'où le chargement de l'entité + projection après
/// matérialisation. <c>Dimensions</c> est une entité RÉGULIÈRE (cf. EPIC 9.5 : abandon d'OwnsMany
/// pour permettre le CRUD admin sur tous les fournisseurs EF) : elle doit donc être <c>Include</c>
/// EXPLICITEMENT (plus d'auto-include owned), tout comme la navigation <c>Category</c>.
/// <c>AsNoTracking()</c> : lecture seule. Slug inconnu → <see cref="NotFoundException"/> (404).
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
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
            .Include(m => m.Dimensions)
            .FirstOrDefaultAsync(m => m.Slug == query.Slug, ct)
            ?? throw new NotFoundException(nameof(ShelterModel), query.Slug);

        return new ShelterModelDetailDto(
            model.Id,
            model.Slug,
            model.Name,
            model.Category.Id,
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
