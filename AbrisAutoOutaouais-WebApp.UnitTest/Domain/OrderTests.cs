using Domain.Entities;
using Domain.ValueObjects;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

public sealed class OrderTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Product MakeProduct(decimal price = 100m, int stock = 5)
        => Product.Create("Abri", "abri", price, stock, Guid.NewGuid());

    private static Address MakeAddress()
        => Address.Create("123", "rue des Érables", null, "Saint-Jérôme", "QC", "J7Z1A1");

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithPickup_DoesNotRequireAddress()
    {
        var product = MakeProduct();
        var items = new[] { (product, 2) }.ToList<(Product, int)>();

        var order = Order.Create(Guid.NewGuid(), DeliveryType.Pickup, items);

        order.Should().NotBeNull();
        order.DeliveryType.Should().Be(DeliveryType.Pickup);
        order.ShippingAddress.Should().BeNull();
        order.Status.Should().Be(OrderStatus.Pending);
    }

    [Fact]
    public void Create_WithDelivery_RequiresAddress()
    {
        var product = MakeProduct();
        var items = new[] { (product, 1) }.ToList<(Product, int)>();

        var act = () => Order.Create(Guid.NewGuid(), DeliveryType.Delivery, items);

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*adresse*");
    }

    [Fact]
    public void Create_WithDeliveryAndAddress_Succeeds()
    {
        var product = MakeProduct(price: 200m);
        var items = new[] { (product, 3) }.ToList<(Product, int)>();
        var address = MakeAddress();

        var order = Order.Create(Guid.NewGuid(), DeliveryType.Delivery, items, address);

        order.TotalAmount.Should().Be(600m);   // 200 * 3
        order.Lines.Should().HaveCount(1);
        order.ShippingAddress.Should().NotBeNull();
    }

    [Fact]
    public void Create_WithEmptyItems_Throws()
    {
        var act = () => Order.Create(
            Guid.NewGuid(), DeliveryType.Pickup,
            new List<(Product, int)>());

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*au moins un produit*");
    }

    // ── Lignes d'abri configuré (EPIC 9.4) ──────────────────────────────────────

    private static Order.ShelterLineInput Shelter(decimal unitPrice = 499m, int qty = 1)
        => new("abri-simple", "Abri simple", 488, 198, unitPrice, qty);

    [Fact]
    public void Create_WithShelterLineOnly_IsAccepted()
    {
        var order = Order.Create(
            Guid.NewGuid(), DeliveryType.Pickup,
            new List<(Product, int)>(),                 // aucun produit classique
            shelterLines: [Shelter(unitPrice: 499m)]);

        order.Should().NotBeNull();
        order.Lines.Should().HaveCount(1);
        order.TotalAmount.Should().Be(499m);
        var line = order.Lines[0];
        line.ProductId.Should().BeNull();
        line.ShelterModelSlug.Should().Be("abri-simple");
        line.ConfiguredLengthCm.Should().Be(488);
        line.ConfiguredClearHeightCm.Should().Be(198);
        line.ProductName.Should().Contain("488");
        line.ProductName.Should().Contain("198");
    }

    [Fact]
    public void Create_WithProductAndShelterLines_SumsTotalOverBoth()
    {
        var product = MakeProduct(price: 200m);
        var items = new[] { (product, 2) }.ToList<(Product, int)>();  // 400

        var order = Order.Create(
            Guid.NewGuid(), DeliveryType.Pickup,
            items,
            shelterLines: [Shelter(unitPrice: 499m, qty: 2)]);          // 998

        order.Lines.Should().HaveCount(2);
        order.TotalAmount.Should().Be(1398m);                          // 400 + 998
    }

    [Fact]
    public void Create_WithNeitherProductNorShelter_Throws()
    {
        var act = () => Order.Create(
            Guid.NewGuid(), DeliveryType.Pickup,
            new List<(Product, int)>(),
            shelterLines: []);

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*au moins un produit*");
    }

    [Fact]
    public void Create_WithUnavailableProduct_Throws()
    {
        var product = Product.Create("Abri", "abri", 100m, 0, Guid.NewGuid()); // stock 0
        var items = new[] { (product, 1) }.ToList<(Product, int)>();

        var act = () => Order.Create(Guid.NewGuid(), DeliveryType.Pickup, items);

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*disponible*");
    }

    // ── TotalAmount ───────────────────────────────────────────────────────────

    [Theory]
    [InlineData(100, 1, 100)]
    [InlineData(50, 3, 150)]
    [InlineData(299.99, 2, 599.98)]
    public void Create_TotalAmountIsCorrect(decimal price, int qty, decimal expected)
    {
        var product = MakeProduct(price: price);
        var items = new[] { (product, qty) }.ToList<(Product, int)>();

        var order = Order.Create(Guid.NewGuid(), DeliveryType.Pickup, items);

        order.TotalAmount.Should().Be(expected);
    }

    // ── Status transitions ────────────────────────────────────────────────────

    [Fact]
    public void Confirm_FromPending_ChangesStatusToConfirmed()
    {
        var product = MakeProduct();
        var order = Order.Create(Guid.NewGuid(), DeliveryType.Pickup,
            new[] { (product, 1) }.ToList<(Product, int)>());

        order.Confirm();

        order.Status.Should().Be(OrderStatus.Confirmed);
    }

    [Fact]
    public void Confirm_FromConfirmed_Throws()
    {
        var product = MakeProduct();
        var order = Order.Create(Guid.NewGuid(), DeliveryType.Pickup,
            new[] { (product, 1) }.ToList<(Product, int)>());

        order.Confirm();
        var act = () => order.Confirm();

        act.Should().Throw<BusinessRuleException>();
    }

    [Fact]
    public void Cancel_FromPending_Succeeds()
    {
        var product = MakeProduct();
        var order = Order.Create(Guid.NewGuid(), DeliveryType.Pickup,
            new[] { (product, 1) }.ToList<(Product, int)>());

        order.Cancel();

        order.Status.Should().Be(OrderStatus.Cancelled);
    }

    // ── Paiement (virement Interac) — EPIC 7, 7.0 ──────────────────────────────

    private static Order MakePendingOrder()
        => Order.Create(Guid.NewGuid(), DeliveryType.Pickup,
            new[] { (MakeProduct(), 1) }.ToList<(Product, int)>());

    [Fact]
    public void AttachPaymentReference_FromPending_SetsPendingPaymentInfo()
    {
        var order = MakePendingOrder();

        order.AttachPaymentReference("ABR-ABCDEF123456");

        order.Payment.Should().NotBeNull();
        order.Payment!.Reference.Should().Be("ABR-ABCDEF123456");
        order.Payment.ConfirmedAt.Should().BeNull();
        order.Status.Should().Be(OrderStatus.Pending);   // l'attachement ne confirme rien
    }

    [Fact]
    public void AttachPaymentReference_WhenNotPending_Throws()
    {
        var order = MakePendingOrder();
        order.Confirm();   // n'est plus en attente

        var act = () => order.AttachPaymentReference("ABR-XYZ");

        act.Should().Throw<BusinessRuleException>().WithMessage("*en attente*");
    }

    [Fact]
    public void MarkPaid_FromPendingWithReference_ConfirmsPaymentAndOrder()
    {
        var order = MakePendingOrder();
        order.AttachPaymentReference("ABR-REF000000001");
        var now = new DateTime(2026, 6, 23, 14, 0, 0, DateTimeKind.Utc);

        order.MarkPaid(now);

        order.Status.Should().Be(OrderStatus.Confirmed);
        order.Payment!.ConfirmedAt.Should().Be(now);
        order.Payment.Reference.Should().Be("ABR-REF000000001");   // la référence est conservée
    }

    [Fact]
    public void MarkPaid_CalledTwice_ThrowsOnSecondCall_Idempotence()
    {
        var order = MakePendingOrder();
        order.AttachPaymentReference("ABR-REF000000002");
        var now = new DateTime(2026, 6, 23, 14, 0, 0, DateTimeKind.Utc);
        order.MarkPaid(now);

        // 2ᵉ appel : la commande n'est plus en attente → garde de Confirm() (L-046).
        var act = () => order.MarkPaid(now.AddMinutes(5));

        act.Should().Throw<BusinessRuleException>();
        order.Payment!.ConfirmedAt.Should().Be(now);   // inchangé par l'appel rejeté
    }

    [Fact]
    public void MarkPaid_WithoutAttachedReference_Throws()
    {
        var order = MakePendingOrder();   // aucune référence attachée

        var act = () => order.MarkPaid(DateTime.UtcNow);

        act.Should().Throw<BusinessRuleException>().WithMessage("*référence de paiement*");
    }
}
