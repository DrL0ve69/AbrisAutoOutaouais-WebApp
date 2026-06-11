using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using Domain.Entities;
using Domain.ValueObjects;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Agrégat commande.
/// CustomerId = Guid référençant AppUser.Id (pas de navigation Domain → Infrastructure).
/// La FK EF est configurée dans Infrastructure/Persistence/Configurations/OrderConfiguration.
/// </summary>
public sealed class Order : ISoftDeletable, IAuditableEntity
{
    private readonly List<OrderLine> _lines = [];

    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }  // réf AppUser.Id
    public OrderStatus Status { get; private set; }
    public DeliveryType DeliveryType { get; private set; }
    public Address? ShippingAddress { get; private set; } // null si ramassage
    public decimal TotalAmount { get; private set; }
    public string? Notes { get; private set; }

    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private Order() { }

    public static Order Create(
        Guid customerId, DeliveryType deliveryType,
        IReadOnlyList<(Product Product, int Qty)> items,
        Address? shippingAddress = null,
        string? notes = null)
    {
        if (!items.Any())
            throw new BusinessRuleException("Une commande doit contenir au moins un produit.");

        if (deliveryType == DeliveryType.Delivery && shippingAddress is null)
            throw new BusinessRuleException("Une adresse de livraison est requise.");

        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            Status = OrderStatus.Pending,
            DeliveryType = deliveryType,
            ShippingAddress = shippingAddress,
            Notes = notes?.Trim(),
        };

        foreach (var (product, qty) in items)
        {
            if (!product.IsAvailable)
                throw new BusinessRuleException($"« {product.Name} » n'est plus disponible.");
            order._lines.Add(OrderLine.Create(order.Id, product, qty));
        }

        order.TotalAmount = order._lines.Sum(l => l.LineTotal);
        return order;
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new BusinessRuleException("Seule une commande en attente peut être confirmée.");
        Status = OrderStatus.Confirmed;
    }

    public void Cancel()
    {
        if (Status is OrderStatus.Delivered or OrderStatus.Shipped)
            throw new BusinessRuleException("Impossible d'annuler une commande déjà expédiée.");
        Status = OrderStatus.Cancelled;
    }

    public void Ship()
    {
        if (Status != OrderStatus.Confirmed)
            throw new BusinessRuleException("Seule une commande confirmée peut être expédiée.");
        Status = OrderStatus.Shipped;
    }

    public void Deliver()
    {
        if (Status != OrderStatus.Shipped)
            throw new BusinessRuleException("Seule une commande expédiée peut être marquée livrée.");
        Status = OrderStatus.Delivered;
    }
}
