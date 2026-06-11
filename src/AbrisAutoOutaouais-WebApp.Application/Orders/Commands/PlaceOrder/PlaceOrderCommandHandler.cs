using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;

/// <summary>
/// Passe une commande : valide les produits, applique les règles métier de l'agrégat
/// <see cref="Order"/>, décrémente le stock et persiste. <c>HandleAsync</c> est appelé par le
/// Dispatcher ; <c>Handle</c> satisfait le contrat et délègue.
/// </summary>
internal sealed class PlaceOrderCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IEmailService email) : ICommandHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> HandleAsync(PlaceOrderCommand cmd, CancellationToken ct)
    {
        if (cmd.Lines is null || cmd.Lines.Count == 0)
            throw new BusinessRuleException("Le panier est vide.");

        var productIds = cmd.Lines.Select(l => l.ProductId).Distinct().ToList();
        var products = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync(ct);

        if (products.Count != productIds.Count)
            throw new BusinessRuleException("Un ou plusieurs produits sont introuvables.");

        var items = cmd.Lines
            .Select(l => (Product: products.First(p => p.Id == l.ProductId), Qty: l.Quantity))
            .ToList();

        Address? address = cmd.ShippingAddress is { } a && !string.IsNullOrWhiteSpace(a.Street)
            ? Address.Create(
                a.Street, a.City,
                string.IsNullOrWhiteSpace(a.Province) ? "QC" : a.Province,
                a.PostalCode,
                string.IsNullOrWhiteSpace(a.Country) ? "Canada" : a.Country)
            : null;

        // Règles métier (panier non vide, adresse si livraison, dispo) dans Order.Create()
        var order = Order.Create(currentUser.UserId!.Value, cmd.DeliveryType, items, address);

        foreach (var (product, qty) in items)
            product.AdjustStock(-qty);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        // L'échec d'envoi du courriel ne doit pas annuler une commande déjà persistée.
        try { await email.SendOrderConfirmationAsync(order.Id, currentUser.Email!, ct); }
        catch { /* journalisé ailleurs ; commande conservée */ }

        return order.Id;
    }

    public ValueTask<Guid> Handle(PlaceOrderCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
