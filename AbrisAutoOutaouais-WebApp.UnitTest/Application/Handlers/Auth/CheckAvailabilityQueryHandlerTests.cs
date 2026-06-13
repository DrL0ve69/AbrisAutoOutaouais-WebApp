using AbrisAutoOutaouais_WebApp.Application.Auth.CheckAvailability;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Auth;

/// <summary>
/// Vérification de disponibilité (H5) : seul un paramètre fourni est évalué
/// (sa disponibilité est null sinon), et « disponible » est l'inverse de « pris ».
/// </summary>
public sealed class CheckAvailabilityQueryHandlerTests
{
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();

    private CheckAvailabilityQueryHandler CreateHandler() => new(_identity);

    [Fact]
    public async Task Handle_WithFreeUsername_ReturnsUsernameAvailableTrue()
    {
        _identity.IsUsernameTakenAsync("nouveau", Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await CreateHandler().HandleAsync(
            new CheckAvailabilityQuery("nouveau", null),
            TestContext.Current.CancellationToken);

        result.UsernameAvailable.Should().BeTrue();
        // Le courriel n'a pas été demandé → null, et le service n'est pas interrogé.
        result.EmailAvailable.Should().BeNull();
        await _identity.DidNotReceiveWithAnyArgs()
            .IsEmailTakenAsync(default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Handle_WithTakenUsername_ReturnsUsernameAvailableFalse()
    {
        _identity.IsUsernameTakenAsync("admin", Arg.Any<CancellationToken>())
            .Returns(true);

        var result = await CreateHandler().HandleAsync(
            new CheckAvailabilityQuery("admin", null),
            TestContext.Current.CancellationToken);

        result.UsernameAvailable.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_WithTakenEmail_ReturnsEmailAvailableFalse()
    {
        _identity.IsEmailTakenAsync("pris@test.com", Arg.Any<CancellationToken>())
            .Returns(true);

        var result = await CreateHandler().HandleAsync(
            new CheckAvailabilityQuery(null, "pris@test.com"),
            TestContext.Current.CancellationToken);

        result.EmailAvailable.Should().BeFalse();
        result.UsernameAvailable.Should().BeNull();
        await _identity.DidNotReceiveWithAnyArgs()
            .IsUsernameTakenAsync(default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Handle_WithBothFree_ReturnsBothAvailableTrue()
    {
        _identity.IsUsernameTakenAsync("libre", Arg.Any<CancellationToken>()).Returns(false);
        _identity.IsEmailTakenAsync("libre@test.com", Arg.Any<CancellationToken>()).Returns(false);

        var result = await CreateHandler().HandleAsync(
            new CheckAvailabilityQuery("libre", "libre@test.com"),
            TestContext.Current.CancellationToken);

        result.UsernameAvailable.Should().BeTrue();
        result.EmailAvailable.Should().BeTrue();
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "   ")]
    public async Task Handle_WithNoUsableParam_ReturnsBothNullAndQueriesNothing(
        string? username, string? email)
    {
        var result = await CreateHandler().HandleAsync(
            new CheckAvailabilityQuery(username, email),
            TestContext.Current.CancellationToken);

        result.UsernameAvailable.Should().BeNull();
        result.EmailAvailable.Should().BeNull();
        await _identity.DidNotReceiveWithAnyArgs()
            .IsUsernameTakenAsync(default!, TestContext.Current.CancellationToken);
        await _identity.DidNotReceiveWithAnyArgs()
            .IsEmailTakenAsync(default!, TestContext.Current.CancellationToken);
    }
}
