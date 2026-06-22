using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Snapshot d'une ligne de commande au moment de l'achat.
/// Prix et nom sont copiés — immuables même si le produit/modèle change après.
///
/// Deux natures de ligne (mutuellement exclusives), distinguées par <see cref="ShelterModelSlug"/> :
///  - ligne PRODUIT classique : <see cref="ProductId"/> non nul, <see cref="ShelterModelSlug"/> nul ;
///  - ligne ABRI CONFIGURÉ (paramétrique, EPIC 9.4) : <see cref="ShelterModelSlug"/> +
///    <see cref="ConfiguredLengthCm"/> non nuls, <see cref="ProductId"/> nul. Le prix est recalculé
///    AUTORITAIREMENT côté serveur (ShelterPriceCalculator) avant le snapshot.
/// </summary>
public sealed class OrderLine
{
    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }

    /// <summary>FK produit — nul pour une ligne d'abri configuré.</summary>
    public Guid? ProductId { get; private set; }

    /// <summary>Slug du modèle d'abri paramétrique — nul pour une ligne produit classique.</summary>
    public string? ShelterModelSlug { get; private set; }

    /// <summary>Longueur configurée en cm — nul pour une ligne produit classique.</summary>
    public int? ConfiguredLengthCm { get; private set; }

    /// <summary>Hauteur dégagée configurée en cm — nul pour une ligne produit classique.</summary>
    public int? ConfiguredClearHeightCm { get; private set; }

    public string ProductName { get; private set; } = string.Empty;  // snapshot
    public decimal UnitPrice { get; private set; }                  // snapshot
    public int Quantity { get; private set; }
    public decimal LineTotal { get; private set; }

    private OrderLine() { }

    internal static OrderLine Create(Guid orderId, Product product, int qty)
    {
        if (qty <= 0) throw new ArgumentException("Quantité doit être positive.");
        return new OrderLine
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            ProductId = product.Id,
            ProductName = product.Name,
            UnitPrice = product.Price,
            Quantity = qty,
            LineTotal = product.Price * qty,
        };
    }

    /// <summary>
    /// Crée une ligne d'ABRI CONFIGURÉ. Le <paramref name="unitPrice"/> est le prix RECALCULÉ par le
    /// serveur (<c>ShelterPriceCalculator</c>) — jamais une valeur fournie par le client. Le snapshot
    /// fige le nom (libellé modèle + longueur) et le prix, comme une ligne produit.
    /// </summary>
    internal static OrderLine CreateShelter(
        Guid orderId, string slug, string modelName, int lengthCm, int clearHeightCm,
        decimal unitPrice, int qty)
    {
        if (string.IsNullOrWhiteSpace(slug)) throw new ArgumentException("Le slug du modèle est requis.");
        if (lengthCm <= 0) throw new ArgumentException("La longueur configurée doit être positive.");
        if (clearHeightCm <= 0) throw new ArgumentException("La hauteur dégagée configurée doit être positive.");
        if (qty <= 0) throw new ArgumentException("Quantité doit être positive.");

        return new OrderLine
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            ProductId = null,
            ShelterModelSlug = slug,
            ConfiguredLengthCm = lengthCm,
            ConfiguredClearHeightCm = clearHeightCm,
            // Snapshot lisible pour le personnel : modèle + longueur + hauteur dégagée (la largeur est
            // portée par le modèle/slug). Format aligné sur la ligne produit (cm canoniques).
            ProductName = $"{modelName} ({lengthCm} cm · H {clearHeightCm} cm)",
            UnitPrice = unitPrice,
            Quantity = qty,
            LineTotal = unitPrice * qty,
        };
    }
}
