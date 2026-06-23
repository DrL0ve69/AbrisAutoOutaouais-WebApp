using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Catalog.Queries.ResolveCatalogSlug;

/// <summary>
/// Résout le type d'un slug : on teste d'abord un MODÈLE d'abri (<c>ShelterModels</c>), puis un
/// produit fixe (<c>Products</c>) ; si aucun ne correspond → <see cref="NotFoundException"/> (404).
/// Les deux DbSet portent un filtre de requête global <c>!IsDeleted</c> (soft delete) : un slug
/// supprimé n'est donc pas résolu. Lectures par <c>AnyAsync</c> (pas de matérialisation d'entité).
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class ResolveCatalogSlugQueryHandler(IApplicationDbContext db)
    : IQueryHandler<ResolveCatalogSlugQuery, CatalogSlugTypeDto>
{
    public async Task<CatalogSlugTypeDto> HandleAsync(
        ResolveCatalogSlugQuery query, CancellationToken ct)
    {
        if (await db.ShelterModels.AnyAsync(m => m.Slug == query.Slug, ct))
        {
            return new CatalogSlugTypeDto("shelter");
        }

        if (await db.Products.AnyAsync(p => p.Slug == query.Slug, ct))
        {
            return new CatalogSlugTypeDto("product");
        }

        throw new NotFoundException(nameof(ShelterModel), query.Slug);
    }

    public ValueTask<CatalogSlugTypeDto> Handle(
        ResolveCatalogSlugQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
