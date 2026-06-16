using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetAllProducts;

/// <summary>
/// Liste paginée des produits, filtrable par catégorie (slug ou nom) et par recherche textuelle.
/// <c>HandleAsync</c> contient la logique (appelé par le Dispatcher) ; <c>Handle</c> satisfait
/// le contrat <see cref="IQueryHandler{TQuery,TResult}"/> et délègue.
/// </summary>
public sealed class GetAllProductsQueryHandler(IApplicationDbContext dbContext)
    : IQueryHandler<GetAllProductsQuery, PaginatedList<ProductDto>>
{
    public async Task<PaginatedList<ProductDto>> HandleAsync(GetAllProductsQuery query, CancellationToken ct)
    {
        var productsQuery = dbContext.Products
            .AsNoTracking()
            .Where(p =>
                (string.IsNullOrEmpty(query.Category)
                    || p.Category.Slug == query.Category
                    || p.Category.Name == query.Category)
                && (string.IsNullOrEmpty(query.Search)
                    || p.Name.Contains(query.Search)))
            .OrderBy(p => p.Name)
            .Select(p => new ProductDto(
                p.Id, p.Name, p.Slug, p.Description, p.Price, p.RentalPrice,
                p.Stock, p.IsAvailable, p.Category.Name,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList(),
                p.WidthCm, p.LengthCm, p.HeightCm, p.Brand, p.Model));

        return await PaginatedList<ProductDto>.CreateAsync(productsQuery, query.Page, query.PageSize, ct);
    }

    public ValueTask<PaginatedList<ProductDto>> Handle(GetAllProductsQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
