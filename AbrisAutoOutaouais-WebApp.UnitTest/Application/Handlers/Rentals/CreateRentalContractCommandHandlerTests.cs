using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Rentals;

/// <summary>
/// Résolution du CustomerId dans CreateRentalContract : connecté → son Id (express jamais appelé) ;
/// visiteur avec contact → Id du compte express ; sinon règle métier (Épic F).
/// </summary>
public sealed class CreateRentalContractCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ICurrentUserService _currentUser = Substitute.For<ICurrentUserService>();
    private readonly IExpressAccountService _express = Substitute.For<IExpressAccountService>();

    private CreateRentalContractCommandHandler CreateHandler()
        => new(_db, _currentUser, _express);

    private async Task<Guid> SeedRentableProductAsync()
    {
        var cat = ProductCategory.Create("Abris", "abris");
        // rentalPrice non null → produit louable.
        var product = Product.Create("Abri Loc", "abri-loc", 599m, 5, cat.Id, "desc.", rentalPrice: 49m);
        _db.ProductCategories.Add(cat);
        _db.Products.Add(product);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return product.Id;
    }

    private static CreateRentalContractCommand Command(Guid productId, GuestContact? guest = null) => new(
        ProductId: productId,
        StartDate: new DateOnly(2026, 7, 1),
        EndDate: new DateOnly(2026, 10, 1),
        Address: new AddressDto("123", "rue des Érables", null, "Gatineau", "QC", "J8X 1A1", "Canada"),
        GuestContact: guest);

    [Fact]
    public async Task Handle_AuthenticatedUser_UsesUserIdAndSkipsExpress()
    {
        var productId = await SeedRentableProductAsync();
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);

        var id = await CreateHandler().HandleAsync(
            Command(productId), TestContext.Current.CancellationToken);

        var contract = await _db.RentalContracts.FindAsync([id], TestContext.Current.CancellationToken);
        contract!.CustomerId.Should().Be(userId);
        await _express.DidNotReceiveWithAnyArgs()
            .FindOrCreateByEmailAsync(Arg.Any<GuestContact>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_GuestWithContact_ResolvesCustomerViaExpressService()
    {
        var productId = await SeedRentableProductAsync();
        var expressId = Guid.NewGuid();
        _currentUser.UserId.Returns((Guid?)null);
        var contact = new GuestContact("Jean", "Tremblay", "jean@test.com", null);
        _express.FindOrCreateByEmailAsync(contact, Arg.Any<CancellationToken>()).Returns(expressId);

        var id = await CreateHandler().HandleAsync(
            Command(productId, contact), TestContext.Current.CancellationToken);

        var contract = await _db.RentalContracts.FindAsync([id], TestContext.Current.CancellationToken);
        contract!.CustomerId.Should().Be(expressId);
    }

    [Fact]
    public async Task Handle_NeitherAuthenticatedNorContact_ThrowsBusinessRule()
    {
        var productId = await SeedRentableProductAsync();
        _currentUser.UserId.Returns((Guid?)null);

        var act = async () => await CreateHandler().HandleAsync(
            Command(productId), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    public void Dispose() => _db.Dispose();
}
