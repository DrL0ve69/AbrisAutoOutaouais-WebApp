using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Categories.Queries.GetAllCategories;

/// <summary>
/// Récupère toutes les catégories de produits, triées par nom, avec leur nombre de produits.
/// </summary>
public sealed record GetAllCategoriesQuery() : IQuery<IReadOnlyList<CategoryDto>>;
