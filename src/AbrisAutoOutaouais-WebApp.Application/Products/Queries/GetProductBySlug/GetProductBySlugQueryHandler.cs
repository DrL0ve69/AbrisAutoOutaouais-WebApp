using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;

public sealed class GetProductBySlugQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetProductBySlugQuery, ProductDto>
{
    public async ValueTask<ProductDto> Handle(
        GetProductBySlugQuery query, CancellationToken ct)
    {
        // AsNoTracking() obligatoire sur les queries — pas de tracking EF inutile
        return await db.Products
            .AsNoTracking()
            .Where(p => p.Slug == query.Slug)
            .Select(p => new ProductDto(
                p.Id, p.Name, p.Slug, p.Description, p.Price, p.RentalPrice,
                p.Stock, p.IsAvailable, p.Category.Name,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList()))
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(Product), query.Slug);
    }
}
