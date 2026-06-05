using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Snapshot d'un produit au moment de la commande.
/// Prix et nom sont copiés — immuables même si le produit change après.
/// </summary>
public sealed class OrderLine
{
    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }
    public Guid ProductId { get; private set; }
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
}
