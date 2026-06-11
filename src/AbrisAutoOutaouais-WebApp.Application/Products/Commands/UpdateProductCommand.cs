using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

/// <summary>
/// Met à jour les détails d'un produit existant (nom, description, prix, stock).
/// Le changement de catégorie n'est pas pris en charge : l'agrégat <c>Product</c> n'expose
/// aucun moyen de modifier <c>CategoryId</c> (setter privé, pas de méthode dédiée).
/// </summary>
public sealed record UpdateProductCommand(
    Guid Id,
    string Name,
    string Description,
    decimal Price,
    int Stock,
    Guid CategoryId
) : ICommand<bool>;
