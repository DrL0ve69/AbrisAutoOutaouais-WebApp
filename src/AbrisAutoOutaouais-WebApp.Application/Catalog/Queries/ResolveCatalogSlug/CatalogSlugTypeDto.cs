namespace AbrisAutoOutaouais_WebApp.Application.Catalog.Queries.ResolveCatalogSlug;

/// <summary>
/// Type résolu d'un slug de catalogue : <c>"shelter"</c> (modèle paramétrique) ou <c>"product"</c>
/// (produit fixe). Sérialisé en camelCase → <c>{ "type": "shelter" }</c>.
/// </summary>
public sealed record CatalogSlugTypeDto(string Type);
