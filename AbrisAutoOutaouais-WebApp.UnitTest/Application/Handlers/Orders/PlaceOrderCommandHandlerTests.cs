using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Orders;

/// <summary>
/// Résolution du CustomerId dans PlaceOrder : utilisateur connecté → son Id (le service express
/// n'est jamais appelé) ; visiteur avec contact → Id du compte express trouvé-ou-créé ; ni l'un
/// ni l'autre → règle métier (Épic F).
/// </summary>
public sealed class PlaceOrderCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ICurrentUserService _currentUser = Substitute.For<ICurrentUserService>();
    private readonly IExpressAccountService _express = Substitute.For<IExpressAccountService>();
    private readonly IEmailService _email = Substitute.For<IEmailService>();

    private PlaceOrderCommandHandler CreateHandler()
        => new(_db, _currentUser, _express, _email);

    private async Task<Guid> SeedProductAsync()
    {
        var cat = ProductCategory.Create("Abris", "abris");
        var product = Product.Create("Abri Test", "abri-test", 199m, 10, cat.Id, "desc.");
        _db.ProductCategories.Add(cat);
        _db.Products.Add(product);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return product.Id;
    }

    /// <summary>
    /// Sème un modèle d'abri paramétrique (« simple » : pas/min 122 cm, base 349 $, 150 $/arche) et
    /// le renvoie pour pouvoir calculer le prix attendu via le MÊME calculateur que le handler.
    /// </summary>
    private async Task<ShelterModel> SeedShelterModelAsync(string slug = "abri-simple")
    {
        var cat = ProductCategory.Create($"Cat {slug}", $"cat-{slug}");
        var model = ShelterModel.Create(
            slug, "Abri simple", cat.Id,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            basePrice: 349.00m, pricePerArchCents: 15000,
            widthsCm: [335, 366], clearHeightsCm: [198]);
        _db.ProductCategories.Add(cat);
        _db.ShelterModels.Add(model);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return model;
    }

    private PlaceOrderCommand ShelterOrder(string slug, int lengthCm, int qty = 1, GuestContact? guest = null) => new(
        Lines: [],
        DeliveryType: DeliveryType.Pickup,
        ShippingAddress: null,
        GuestContact: guest,
        ShelterLines: [new ShelterLineRequest(slug, lengthCm, qty)]);

    private async Task<OrderLine> ReadSingleLineAsync(Guid orderId)
        => await _db.OrderLines.AsNoTracking()
            .SingleAsync(l => l.OrderId == orderId, TestContext.Current.CancellationToken);

    private static PlaceOrderCommand Pickup(Guid productId, GuestContact? guest = null) => new(
        Lines: [new OrderLineRequest(productId, 1)],
        DeliveryType: DeliveryType.Pickup,
        ShippingAddress: null,
        GuestContact: guest);

    [Fact]
    public async Task Handle_AuthenticatedUser_UsesUserIdAndSkipsExpress()
    {
        var productId = await SeedProductAsync();
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);
        _currentUser.Email.Returns("client@test.com");

        var id = await CreateHandler().HandleAsync(
            Pickup(productId), TestContext.Current.CancellationToken);

        var order = await _db.Orders.FindAsync([id], TestContext.Current.CancellationToken);
        order!.CustomerId.Should().Be(userId);
        await _express.DidNotReceiveWithAnyArgs()
            .FindOrCreateByEmailAsync(Arg.Any<GuestContact>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_GuestWithContact_ResolvesCustomerViaExpressService()
    {
        var productId = await SeedProductAsync();
        var expressId = Guid.NewGuid();
        _currentUser.UserId.Returns((Guid?)null);
        _currentUser.Email.Returns((string?)null);
        var contact = new GuestContact("Jean", "Tremblay", "jean@test.com", null);
        _express.FindOrCreateByEmailAsync(contact, Arg.Any<CancellationToken>()).Returns(expressId);

        var id = await CreateHandler().HandleAsync(
            Pickup(productId, contact), TestContext.Current.CancellationToken);

        var order = await _db.Orders.FindAsync([id], TestContext.Current.CancellationToken);
        order!.CustomerId.Should().Be(expressId);
        // Le courriel de confirmation part vers le contact invité (currentUser.Email est null).
        await _email.Received(1).SendOrderConfirmationAsync(id, "jean@test.com", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_NeitherAuthenticatedNorContact_ThrowsBusinessRule()
    {
        var productId = await SeedProductAsync();
        _currentUser.UserId.Returns((Guid?)null);

        var act = async () => await CreateHandler().HandleAsync(
            Pickup(productId), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    // ── Lignes d'abri configuré (EPIC 9.4) ──────────────────────────────────────

    [Fact]
    public async Task Handle_ShelterLine_RecomputesPriceServerSideAndSnapshotsLine()
    {
        var model = await SeedShelterModelAsync();
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);
        _currentUser.Email.Returns("client@test.com");

        // 488 cm = 122 + 3*122 → 3 arches → 349 + 3*150 = 799 $.
        const int lengthCm = 488;
        var expected = ShelterPriceCalculator.CalculatePrice(model, lengthCm);

        var id = await CreateHandler().HandleAsync(
            ShelterOrder(model.Slug, lengthCm), TestContext.Current.CancellationToken);

        var line = await ReadSingleLineAsync(id);
        line.ProductId.Should().BeNull();
        line.ShelterModelSlug.Should().Be(model.Slug);
        line.ConfiguredLengthCm.Should().Be(lengthCm);
        line.UnitPrice.Should().Be(expected);
        line.UnitPrice.Should().Be(799m);   // valeur explicite : ancrage de la formule

        var order = await _db.Orders.FindAsync([id], TestContext.Current.CancellationToken);
        order!.TotalAmount.Should().Be(expected);
    }

    [Fact]
    public async Task Handle_ShelterOnlyOrder_IsAccepted()
    {
        var model = await SeedShelterModelAsync();
        _currentUser.UserId.Returns(Guid.NewGuid());

        var id = await CreateHandler().HandleAsync(
            ShelterOrder(model.Slug, 122), TestContext.Current.CancellationToken);

        var order = await _db.Orders.FindAsync([id], TestContext.Current.CancellationToken);
        order!.Lines.Should().HaveCount(1);
        order.TotalAmount.Should().Be(349.00m);   // longueur de base → 0 arche
    }

    [Fact]
    public async Task Handle_UnknownShelterSlug_ThrowsBusinessRule()
    {
        await SeedShelterModelAsync();
        _currentUser.UserId.Returns(Guid.NewGuid());

        var act = async () => await CreateHandler().HandleAsync(
            ShelterOrder("slug-inexistant", 122), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("*introuvable*");
    }

    [Fact]
    public async Task Handle_ShelterLengthOutOfRange_ThrowsBusinessRule()
    {
        var model = await SeedShelterModelAsync();
        _currentUser.UserId.Returns(Guid.NewGuid());

        // 2000 > MaxLengthCm (1830) → 422 (BusinessRuleException), jamais un 500.
        var act = async () => await CreateHandler().HandleAsync(
            ShelterOrder(model.Slug, 2000), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_ShelterLengthMisaligned_ThrowsBusinessRule()
    {
        var model = await SeedShelterModelAsync();
        _currentUser.UserId.Returns(Guid.NewGuid());

        // 200 cm : dans [122, 1830] mais (200 - 122) = 78 non divisible par 122 → 422.
        var act = async () => await CreateHandler().HandleAsync(
            ShelterOrder(model.Slug, 200), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_MixedProductAndShelterLines_SumsBothIntoTotal()
    {
        var productId = await SeedProductAsync();   // 199 $
        var model = await SeedShelterModelAsync();
        _currentUser.UserId.Returns(Guid.NewGuid());

        const int lengthCm = 122;   // 0 arche → 349 $
        var shelterPrice = ShelterPriceCalculator.CalculatePrice(model, lengthCm);

        var cmd = new PlaceOrderCommand(
            Lines: [new OrderLineRequest(productId, 2)],   // 398 $
            DeliveryType: DeliveryType.Pickup,
            ShippingAddress: null,
            ShelterLines: [new ShelterLineRequest(model.Slug, lengthCm, 1)]);

        var id = await CreateHandler().HandleAsync(cmd, TestContext.Current.CancellationToken);

        var order = await _db.Orders.FindAsync([id], TestContext.Current.CancellationToken);
        order!.Lines.Should().HaveCount(2);
        order.TotalAmount.Should().Be(398m + shelterPrice);   // 398 + 349 = 747
    }

    public void Dispose() => _db.Dispose();
}
