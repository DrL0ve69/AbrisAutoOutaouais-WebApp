using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Categories.Queries.GetAllCategories;

/// <summary>
/// Handler de <see cref="GetAllCategoriesQuery"/>.
/// Implémente <c>HandleAsync</c> (appelé par le Dispatcher) et <c>Handle</c>
/// (contrat <see cref="IQueryHandler{TQuery,TResult}"/> utilisé par Scrutor) qui délègue.
/// </summary>
public sealed class GetAllCategoriesQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetAllCategoriesQuery, IReadOnlyList<CategoryDto>>
{
    public async Task<IReadOnlyList<CategoryDto>> HandleAsync(
        GetAllCategoriesQuery query, CancellationToken ct)
        => await db.ProductCategories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(
                c.Id,
                c.Name,
                c.Slug,
                db.Products.Count(p => p.CategoryId == c.Id)))
            .ToListAsync(ct);

    public ValueTask<IReadOnlyList<CategoryDto>> Handle(
        GetAllCategoriesQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
