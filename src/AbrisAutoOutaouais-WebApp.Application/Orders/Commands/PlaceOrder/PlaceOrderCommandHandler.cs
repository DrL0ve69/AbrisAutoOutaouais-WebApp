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
    IEmailService email,
    IPaymentService payment,
    IPaymentReferenceGenerator paymentReferences) : ICommandHandler<PlaceOrderCommand, PlaceOrderResult>
{
    public async Task<PlaceOrderResult> HandleAsync(PlaceOrderCommand cmd, CancellationToken ct)
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

        // ── Paiement (virement Interac) ────────────────────────────────────────
        // Réf NON DEVINABLE attachée à l'agrégat (statut porté par Order.Payment, pas d'entité Payment).
        // La commande reste Pending : la confirmation passe par la réconciliation admin (confirm-payment).
        // Courriel du CLIENT : celui du connecté, sinon celui du contact invité. Sert au courriel de
        // confirmation ET sera transmis aux fournisseurs automatisés (VoPay/Paysafe, 7.4) ; l'adaptateur
        // manuel l'ignore (il n'utilise que le courriel MARCHAND issu de la config).
        var customerEmail = currentUser.Email ?? cmd.GuestContact!.Email;
        var reference = paymentReferences.Generate();
        order.AttachPaymentReference(reference);

        // Port résilient (jamais d'exception réseau, comme IPlacesService) : pas de try/catch ici.
        var instructions = await payment.InitiateAsync(reference, order.TotalAmount, customerEmail, ct);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        // L'échec d'envoi du courriel ne doit pas annuler une commande déjà persistée.
        try { await email.SendOrderConfirmationAsync(order.Id, customerEmail, ct); }
        catch { /* journalisé ailleurs ; commande conservée */ }

        return new PlaceOrderResult(order.Id, instructions);
    }

    /// <summary>
    /// Charge les modèles d'abri demandés par slug et construit les lignes en RECALCULANT le prix
    /// côté serveur. Un slug inconnu, une longueur hors plage [Min, Max] ou désalignée sur le pas →
    /// <see cref="BusinessRuleException"/> (422), AVANT d'appeler le calculateur de domaine — exactement
    /// comme <c>GetShelterPriceQueryHandler</c> (sinon <c>ArgumentOutOfRangeException</c> → 500 sur une
    /// saisie utilisateur). Le prix n'est JAMAIS refait à la main : on délègue à
    /// <see cref="ShelterPriceCalculator"/> (source unique de la formule — L-004).
    ///
    /// On charge les collections <c>Dimensions</c> ET <c>PriceEntries</c> (<c>.Include</c>, entités
    /// RÉGULIÈRES — L-035) car la HAUTEUR dégagée choisie par le client doit être une des options du
    /// modèle (<c>ClearHeightOptionsCm</c>) ET la combinaison (longueur × hauteur) doit exister dans
    /// la grille de prix (lookup) avant le snapshot. Les bornes Min/Max/Step servent encore à donner
    /// un 422 précis sur la longueur. La largeur n'est PAS validée ici : implicite au slug
    /// (« une largeur = un modèle »).
    /// </summary>
    private async Task<List<Order.ShelterLineInput>> BuildShelterLinesAsync(
        IReadOnlyList<ShelterLineRequest> requests, CancellationToken ct)
    {
        if (requests.Count == 0)
            return [];

        var slugs = requests.Select(r => r.Slug).Distinct().ToList();
        var models = await db.ShelterModels
            .AsNoTracking()                 // lecture seule (convention dépôt) — on ne mute pas le modèle
            .Include(m => m.Dimensions)     // entité régulière → Include explicite requis (L-035)
            .Include(m => m.PriceEntries)   // grille de prix exacte (entité régulière) → Include requis (L-035)
            .Where(m => slugs.Contains(m.Slug))
            .ToDictionaryAsync(m => m.Slug, ct);

        var lines = new List<Order.ShelterLineInput>(requests.Count);
        foreach (var r in requests)
        {
            if (!models.TryGetValue(r.Slug, out var model))
                throw new BusinessRuleException($"Modèle d'abri « {r.Slug} » introuvable.");

            // Validation de la taille (bornes, pas, hauteur offerte, combinaison tarifée) par la source
            // UNIQUE et partagée avec la location (L-004) — AVANT le calculateur (sinon
            // ArgumentOutOfRangeException → 500). Toute garde violée → BusinessRuleException (422).
            ShelterSizeRules.ValidateSize(model, r.LengthCm, r.ClearHeightCm);

            var unitPrice = ShelterPriceCalculator.CalculatePrice(model, r.LengthCm, r.ClearHeightCm);
            lines.Add(new Order.ShelterLineInput(
                model.Slug, model.Name, r.LengthCm, r.ClearHeightCm, unitPrice, r.Quantity));
        }

        return lines;
    }

    public ValueTask<PlaceOrderResult> Handle(PlaceOrderCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
