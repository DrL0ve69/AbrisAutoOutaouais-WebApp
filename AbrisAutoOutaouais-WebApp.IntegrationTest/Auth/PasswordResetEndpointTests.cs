using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using NSubstitute;
using System;
using System.Linq;
using System.Web;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Auth;

/// <summary>
/// Parcours complet de réinitialisation du mot de passe :
/// inscription → forgot-password (202) → lien capturé via le substitut
/// IEmailService → reset-password (204) → connexion avec le nouveau mot de
/// passe (l'ancien est refusé). Plus les chemins d'erreur (jeton invalide,
/// courriel inconnu — anti-énumération).
/// </summary>
[Collection("Integration")]
public sealed class PasswordResetEndpointTests(WebAppFactory factory)
    : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client = factory.Client;
    private readonly WebAppFactory _factory = factory;

    private async Task<string> RegisterUserAsync(string email, string password)
    {
        var unique = Guid.NewGuid().ToString("N")[..8];
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username = $"reset-{unique}",
            firstName = "Rita",
            lastName = "Réinit",
            password,
            confirmPassword = password,
        });
        response.EnsureSuccessStatusCode();
        return email;
    }

    /// <summary>Récupère le dernier lien de réinitialisation « envoyé » à ce courriel.</summary>
    private string GetLastResetLinkFor(string email) =>
        (string)_factory.EmailService.ReceivedCalls()
            .Where(c => c.GetMethodInfo().Name == nameof(IEmailService.SendPasswordResetAsync))
            .Select(c => c.GetArguments())
            .Last(args => (string)args[0]! == email)[1]!;

    [Fact]
    public async Task ForgotThenReset_AllowsLoginWithNewPasswordOnly()
    {
        const string oldPassword = "Ancien@123!";
        const string newPassword = "Nouveau@456!";
        var email = await RegisterUserAsync(
            $"reset-{Guid.NewGuid():N}@test.com", oldPassword);

        // 1. Demande de réinitialisation → toujours 202.
        var forgot = await _client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email });
        forgot.StatusCode.Should().Be(HttpStatusCode.Accepted);

        // 2. Le « courriel » a été envoyé avec un lien vers la page client.
        var link = GetLastResetLinkFor(email);
        link.Should().StartWith("http://localhost:4200/auth/reset?email=");

        // 3. Extraire le jeton du lien (ParseQueryString décode l'échappement URL).
        var query = HttpUtility.ParseQueryString(new Uri(link).Query);
        var token = query["token"];
        token.Should().NotBeNullOrEmpty();
        query["email"].Should().Be(email);

        // 4. Réinitialiser → 204.
        var reset = await _client.PostAsJsonAsync("/api/v1/auth/reset-password", new
        {
            email,
            token,
            newPassword,
            confirmPassword = newPassword,
        });
        reset.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // 5. L'ancien mot de passe est refusé, le nouveau accepté.
        var oldLogin = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new { email, password = oldPassword });
        oldLogin.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var newLogin = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new { email, password = newPassword });
        newLogin.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResetPassword_WithInvalidToken_Returns400()
    {
        const string password = "Ancien@123!";
        var email = await RegisterUserAsync(
            $"reset-invalide-{Guid.NewGuid():N}@test.com", password);

        var reset = await _client.PostAsJsonAsync("/api/v1/auth/reset-password", new
        {
            email,
            token = "jeton-invalide",
            newPassword = "Nouveau@456!",
            confirmPassword = "Nouveau@456!",
        });

        // Result.Failure → 400 BadRequest (idiome du contrôleur).
        reset.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Le mot de passe d'origine fonctionne toujours.
        var login = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        login.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ForgotPassword_WithUnknownEmail_Returns202AndSendsNothing()
    {
        var unknown = $"inconnu-{Guid.NewGuid():N}@test.com";

        var forgot = await _client.PostAsJsonAsync("/api/v1/auth/forgot-password",
            new { email = unknown });

        // Anti-énumération : même réponse qu'un compte existant…
        forgot.StatusCode.Should().Be(HttpStatusCode.Accepted);

        // …mais aucun courriel pour cette adresse.
        _factory.EmailService.ReceivedCalls()
            .Where(c => c.GetMethodInfo().Name == nameof(IEmailService.SendPasswordResetAsync))
            .Select(c => (string)c.GetArguments()[0]!)
            .Should().NotContain(unknown);
    }
}
