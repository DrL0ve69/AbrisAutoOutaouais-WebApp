namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetShelterCatalog;

/// <summary>
/// Catalogue marque → modèles dérivé des produits qui portent une marque ET un modèle.
/// Sert à alimenter les listes déroulantes du formulaire d'installation (G2) : on choisit
/// une marque, puis un modèle, dont on affiche les dimensions hors-tout pour information.
/// </summary>
public sealed record BrandCatalogDto(string Brand, IReadOnlyList<ModelCatalogDto> Models);

/// <summary>
/// Un modèle distinct d'une marque, avec son <see cref="Slug"/> (lien produit) et ses
/// dimensions hors-tout en centimètres (nullables : certains modèles ne les publient pas).
/// </summary>
public sealed record ModelCatalogDto(
    string Model,
    string Slug,
    int? WidthCm,
    int? LengthCm,
    int? HeightCm);
