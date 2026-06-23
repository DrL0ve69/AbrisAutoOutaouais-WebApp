namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetShelterCatalog;

/// <summary>
/// Catalogue marque → modèles dérivé du RÉFÉRENTIEL des modèles d'abris paramétriques (EPIC 9).
/// Sert à alimenter les listes déroulantes du formulaire d'installation (G2) : on choisit
/// une marque, puis un modèle, dont on affiche les dimensions REPRÉSENTATIVES pour information.
/// </summary>
public sealed record BrandCatalogDto(string Brand, IReadOnlyList<ModelCatalogDto> Models);

/// <summary>
/// Un modèle distinct d'une marque, avec son <see cref="Slug"/> (lien modèle) et ses dimensions
/// REPRÉSENTATIVES en centimètres (largeur du modèle, longueur de base, hauteur dégagée minimale ;
/// nullables si le modèle n'a aucune option de la dimension correspondante).
/// </summary>
public sealed record ModelCatalogDto(
    string Model,
    string Slug,
    int? WidthCm,
    int? LengthCm,
    int? HeightCm);
