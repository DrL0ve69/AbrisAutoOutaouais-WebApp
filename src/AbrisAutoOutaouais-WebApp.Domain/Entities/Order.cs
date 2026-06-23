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

    /// <summary>
    /// Information de paiement (Owned VO <see cref="PaymentInfo"/>). NULLABLE : les commandes
    /// antérieures à la migration EPIC 7 n'en portent pas, et l'agrégat est créé sans paiement
    /// (la référence est attachée juste après par <see cref="AttachPaymentReference"/>).
    /// </summary>
    public PaymentInfo? Payment { get; private set; }

    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private Order() { }

    /// <summary>
    /// Entrée d'une ligne d'ABRI CONFIGURÉ (paramétrique, EPIC 9.4). Le <c>UnitPrice</c> est le prix
    /// RECALCULÉ côté serveur (<c>ShelterPriceCalculator</c>) — jamais une valeur fournie par le client.
    /// </summary>
    public readonly record struct ShelterLineInput(
        string Slug, string ModelName, int LengthCm, int ClearHeightCm, decimal UnitPrice, int Qty);

    public static Order Create(
        Guid customerId, DeliveryType deliveryType,
        IReadOnlyList<(Product Product, int Qty)> items,
        Address? shippingAddress = null,
        string? notes = null,
        IReadOnlyList<ShelterLineInput>? shelterLines = null)
    {
        shelterLines ??= [];

        // Une commande est valide si elle contient au moins une ligne — produit OU abri configuré
        // (une commande d'abri seul est légitime). On considère les DEUX natures de ligne.
        if (items.Count == 0 && shelterLines.Count == 0)
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

        foreach (var s in shelterLines)
            order._lines.Add(OrderLine.CreateShelter(
                order.Id, s.Slug, s.ModelName, s.LengthCm, s.ClearHeightCm, s.UnitPrice, s.Qty));

        order.TotalAmount = order._lines.Sum(l => l.LineTotal);
        return order;
    }

    /// <summary>
    /// Attache une référence de paiement (virement Interac) à la commande, en posant un
    /// <see cref="PaymentInfo"/> EN ATTENTE. Garde : seulement tant que la commande est en attente
    /// (<see cref="OrderStatus.Pending"/>) — on n'altère pas le paiement d'une commande déjà avancée.
    /// </summary>
    public void AttachPaymentReference(string reference)
    {
        if (Status != OrderStatus.Pending)
            throw new BusinessRuleException(
                "Une référence de paiement ne peut être attachée qu'à une commande en attente.");
        Payment = PaymentInfo.Pending(reference);
    }

    /// <summary>
    /// Marque la commande comme PAYÉE : confirme le paiement (<see cref="PaymentInfo.Confirm"/>) PUIS
    /// confirme la commande (<see cref="Confirm"/>). La garde de <see cref="Confirm"/> assure
    /// l'idempotence (L-046) : un 2ᵉ appel sur une commande déjà confirmée lève proprement une
    /// <see cref="BusinessRuleException"/>.
    /// </summary>
    public void MarkPaid(DateTime nowUtc)
    {
        if (Payment is null)
            throw new BusinessRuleException(
                "Aucune référence de paiement n'est attachée à cette commande.");

        // Invariant porté par le paiement lui-même (et pas seulement par le statut de la commande) :
        // un paiement déjà confirmé ne se re-confirme pas — défense en profondeur (L-046).
        if (Payment.ConfirmedAt is not null)
            throw new BusinessRuleException("Le paiement de cette commande est déjà confirmé.");

        // Confirme le paiement AVANT la commande : si Confirm() lève (statut non-Pending),
        // l'horodatage de paiement n'aura pas été posé sur une commande non confirmable.
        var confirmedPayment = Payment.Confirm(nowUtc);
        Confirm();   // garde existante : Status != Pending → BusinessRuleException (idempotence)
        Payment = confirmedPayment;
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
