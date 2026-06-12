using AbrisAutoOutaouais_WebApp.Application.Auth.ForgotPassword;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Auth;

public sealed class ForgotPasswordCommandHandlerTests
{
    private const string BaseUrl = "http://localhost:4200";

    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();
    private readonly IEmailService _email = Substitute.For<IEmailService>();
    private readonly IClientUrlProvider _clientUrl = Substitute.For<IClientUrlProvider>();

    private ForgotPasswordCommandHandler CreateHandler()
    {
        _clientUrl.BaseUrl.Returns(BaseUrl);
        return new ForgotPasswordCommandHandler(_identity, _email, _clientUrl);
    }

    [Fact]
    public async Task Handle_WithKnownEmail_SendsLinkWithEscapedToken()
    {
        // Jeton Identity typique : contient des caractères non sûrs en URL (+, /, =).
        const string email = "client@test.com";
        const string token = "CfDJ8+abc/def==";
        _identity.GeneratePasswordResetTokenAsync(email, Arg.Any<CancellationToken>())
            .Returns(Result<string>.Success(token));

        await CreateHandler().HandleAsync(
            new ForgotPasswordCommand(email), TestContext.Current.CancellationToken);

        // Le lien pointe vers la page /auth/reset du client et porte le jeton ÉCHAPPÉ
        // (un « + » nu serait décodé en espace côté client → jeton corrompu).
        await _email.Received(1).SendPasswordResetAsync(
            email,
            Arg.Is<string>(link =>
                link.StartsWith($"{BaseUrl}/auth/reset?email=") &&
                link.Contains($"&token={Uri.EscapeDataString(token)}")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithUnknownEmail_SucceedsWithoutSendingEmail()
    {
        // Anti-énumération : compte inconnu → même résultat, mais AUCUN courriel.
        _identity.GeneratePasswordResetTokenAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Result<string>.Failure("Utilisateur introuvable."));

        var act = async () => await CreateHandler().HandleAsync(
            new ForgotPasswordCommand("inconnu@test.com"), TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
        await _email.DidNotReceiveWithAnyArgs()
            .SendPasswordResetAsync(default!, default!, TestContext.Current.CancellationToken);
    }
}
