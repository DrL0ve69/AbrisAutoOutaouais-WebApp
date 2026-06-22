using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Customers.Queries.SearchCustomers;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Customers;

/// <summary>
/// Le handler de recherche de clients délègue au port <see cref="IIdentityService"/> en passant
/// le terme et la limite (10), et renvoie tel quel le résultat — aucune logique propre (frontière).
/// </summary>
public sealed class SearchCustomersQueryHandlerTests
{
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();

    private SearchCustomersQueryHandler CreateHandler() => new(_identity);

    [Fact]
    public async Task Handle_DelegatesToIdentityWithTermAndTopTen()
    {
        var expected = new List<CustomerSearchResultDto>
        {
            new(Guid.NewGuid(), "Jean Tremblay", "jean@test.com"),
        };
        _identity.SearchCustomersAsync("trem", 10, Arg.Any<CancellationToken>())
            .Returns(expected);

        var result = await CreateHandler().HandleAsync(
            new SearchCustomersQuery("trem"), TestContext.Current.CancellationToken);

        result.Should().BeSameAs(expected);
        await _identity.Received(1)
            .SearchCustomersAsync("trem", 10, Arg.Any<CancellationToken>());
    }
}
