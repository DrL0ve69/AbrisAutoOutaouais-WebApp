using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Services;
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
    IExpressAccountService express,
    IEmailService email) : ICommandHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> HandleAsync(PlaceOrderCommand cmd, CancellationToken ct)
    {
        var productLines = cmd.Lines ?? [];
        var shelterRequests = cmd.ShelterLines ?? [];

        // Une commande est valide dès qu'elle porte au moins une ligne — produit OU abri configuré
        // (une commande d'abri seul est légitime).
        if (productLines.Count == 0 && shelterRequests.Count == 0)
            throw new BusinessRuleException("Le panier est vide.");

        // Utilisateur connecté → son Id ; sinon visiteur → compte express trouvé-ou-créé par courriel.
        var customerId = currentUser.UserId
            ?? (cmd.GuestContact is not null
                ? await express.FindOrCreateByEmailAsync(cmd.GuestContact, ct)
                : throw new BusinessRuleException("Coordonnées requises pour passer une commande."));

        var productIds = productLines.Select(l => l.ProductId).Distinct().ToList();
        var products = productIds.Count == 0
            ? []
            : await db.Products
                .Where(p => productIds.Contains(p.Id))
                .ToListAsync(ct);

        if (products.Count != productIds.Count)
            throw new BusinessRuleException("Un ou plusieurs produits sont introuvables.");

        var items = productLines
            .Select(l => (Product: products.First(p => p.Id == l.ProductId), Qty: l.Quantity))
            .ToList();

        // ── Lignes d'abri configuré : prix RECALCULÉ côté serveur (jamais une valeur client) ──
        var shelterLines = await BuildShelterLinesAsync(shelterRequests, ct);

        Address? address = cmd.ShippingAddress is { } a && !string.IsNullOrWhiteSpace(a.Street)
            ? Address.Create(
                a.CivicNumber, a.Street, a.Apartment, a.City,
                string.IsNullOrWhiteSpace(a.Province) ? "QC" : a.Province,
                a.PostalCode,
                string.IsNullOrWhiteSpace(a.Country) ? "Canada" : a.Country)
            : null;

        // Règles métier (panier non vide, adresse si livraison, dispo) dans Order.Create()
        var order = Order.Create(customerId, cmd.DeliveryType, items, address, shelterLines: shelterLines);

        foreach (var (product, qty) in items)
            product.AdjustStock(-qty);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        // L'échec d'envoi du courriel ne doit pas annuler une commande déjà persistée.
        // Destinataire : courriel du connecté, sinon celui du contact invité.
        var recipient = currentUser.Email ?? cmd.GuestContact!.Email;
        try { await email.SendOrderConfirmationAsync(order.Id, recipient, ct); }
        catch { /* journalisé ailleurs ; commande conservée */ }

        return order.Id;
    }

    /// <summary>
    /// Charge les modèles d'abri demandés par slug et construit les lignes en RECALCULANT le prix
    /// côté serveur. Un slug inconnu, une longueur hors plage [Min, Max] ou désalignée sur le pas →
    /// <see cref="BusinessRuleException"/> (422), AVANT d'appeler le calculateur de domaine — exactement
    /// comme <c>GetShelterPriceQueryHandler</c> (sinon <c>ArgumentOutOfRangeException</c> → 500 sur une
    /// saisie utilisateur). Le prix n'est JAMAIS refait à la main : on délègue à
    /// <see cref="ShelterPriceCalculator"/> (source unique de la formule — L-004).
    ///
    /// On NE charge PAS la collection possédée <c>Dimensions</c> (pas de <c>.Include</c> : EF lève sur
    /// une collection owned) — seuls les champs scalaires de tarification sont nécessaires.
    /// </summary>
    private async Task<List<Order.ShelterLineInput>> BuildShelterLinesAsync(
        IReadOnlyList<ShelterLineRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0)
            return [];

        var slugs = requests.Select(r => r.Slug).Distinct().ToList();
        var models = await db.ShelterModels
            .Where(m => slugs.Contains(m.Slug))
            .ToDictionaryAsync(m => m.Slug, ct);

        var lines = new List<Order.ShelterLineInput>(requests.Count);
        foreach (var r in requests)
        {
            if (!models.TryGetValue(r.Slug, out var model))
                throw new BusinessRuleException($"Modèle d'abri « {r.Slug} » introuvable.");

            // Bornes + alignement validés AVANT le calculateur (sinon ArgumentOutOfRangeException → 500).
            if (r.LengthCm < model.MinLengthCm || r.LengthCm > model.MaxLengthCm)
                throw new BusinessRuleException(
                    $"La longueur doit être comprise entre {model.MinLengthCm} et {model.MaxLengthCm} cm.");

            if ((r.LengthCm - model.MinLengthCm) % model.LengthStepCm != 0)
                throw new BusinessRuleException(
                    $"La longueur doit être alignée sur le pas de {model.LengthStepCm} cm depuis {model.MinLengthCm} cm.");

            var unitPrice = ShelterPriceCalculator.CalculatePrice(model, r.LengthCm);
            lines.Add(new Order.ShelterLineInput(model.Slug, model.Name, r.LengthCm, unitPrice, r.Quantity));
        }

        return lines;
    }

    public ValueTask<Guid> Handle(PlaceOrderCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
