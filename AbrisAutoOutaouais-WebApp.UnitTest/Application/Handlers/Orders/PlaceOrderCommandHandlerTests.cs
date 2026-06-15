using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
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

    public void Dispose() => _db.Dispose();
}
