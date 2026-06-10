using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetAllProducts;

public class GetAllProductsQueryHandler(IApplicationDbContext dbContext)
    : IQueryHandler<GetAllProductsQuery, PaginatedList<ProductDto>>
{
    public async ValueTask<PaginatedList<ProductDto>> Handle(GetAllProductsQuery query, CancellationToken ct)
    {
        var productsQuery = dbContext.Products
            .AsNoTracking()
            .Where(p => (string.IsNullOrEmpty(query.Category) || p.Category.Name == query.Category) &&
                (string.IsNullOrEmpty(query.Search) || p.Name.Contains(query.Search)))
            .Select(p => new ProductDto(
        p.Id, p.Name, p.Slug, p.Description, p.Price, p.RentalPrice,
        p.Stock, p.IsAvailable, p.Category.Name,
        p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList()));

        return await PaginatedList<ProductDto>.CreateAsync(productsQuery, query.Page, query.PageSize, ct);
    }

    public async Task<PaginatedList<ProductDto>> HandleAsync(GetAllProductsQuery query, CancellationToken ct)
    {
        var productsQuery = dbContext.Products
    .AsNoTracking()
    .Where(p => (string.IsNullOrEmpty(query.Category) || p.Category.Name == query.Category) &&
                (string.IsNullOrEmpty(query.Search) || p.Name.Contains(query.Search)))
    .Select(p => new ProductDto(
        p.Id, p.Name, p.Slug, p.Description, p.Price, p.RentalPrice,
        p.Stock, p.IsAvailable, p.Category.Name,
        p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList()));
        return await PaginatedList<ProductDto>.CreateAsync(productsQuery, query.Page, query.PageSize, ct);
    }
}

