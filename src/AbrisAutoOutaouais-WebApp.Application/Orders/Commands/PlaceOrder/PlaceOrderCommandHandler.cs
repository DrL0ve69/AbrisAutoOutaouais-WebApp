using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;

internal sealed class PlaceOrderCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IEmailService email) : ICommandHandler<PlaceOrderCommand, Guid>
{
    public async ValueTask<Guid> Handle(PlaceOrderCommand cmd, CancellationToken ct)
    {
        // 1. Charger les produits demandés
        var productIds = cmd.Lines.Select(l => l.ProductId).ToList();
        var products = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync(ct);

        if (products.Count != productIds.Count)
            throw new BusinessRuleException("Un ou plusieurs produits sont introuvables.");

        // 2. Construire les paires (produit, quantité)
        var items = cmd.Lines
            .Select(l => (Product: products.First(p => p.Id == l.ProductId), Qty: l.Quantity))
            .ToList();

        // 3. Construire l'adresse si livraison
        Address? address = cmd.ShippingAddress is { } a
            ? Address.Create(a.Street, a.City, a.Province, a.PostalCode)
            : null;

        // 4. Créer l'agrégat — les règles métier sont dans Order.Create()
        var order = Order.Create((Guid)currentUser.UserId!, cmd.DeliveryType, items, address);

        // 5. Décrémenter le stock
        foreach (var (product, qty) in items)
            product.AdjustStock(-qty);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        // 6. Email de confirmation (fire and forget acceptable)
        await email.SendOrderConfirmationAsync(order.Id, currentUser.Email!, ct);

        return order.Id;
    }
}
