namespace AbrisAutoOutaouais_WebApp.Application.Categories.Queries.GetAllCategories;

/// <summary>
/// Catégorie de produits exposée au frontend (avec le nombre de produits actifs).
/// </summary>
public sealed record CategoryDto(
    Guid Id,
    string Name,
    string Slug,
    int ProductCount);
