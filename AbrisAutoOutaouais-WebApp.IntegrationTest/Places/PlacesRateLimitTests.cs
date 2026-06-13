using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Places;

/// <summary>
/// Smoke test du rate limiter (« places » : 30 req / 10 s). Isolé dans sa PROPRE classe, donc
/// sa propre instance de <see cref="WebAppFactory"/> via <c>IClassFixture</c> → son propre
/// limiteur en mémoire : épuiser la fenêtre ici ne touche pas le quota des autres tests.
/// Reste dans la collection « Integration » : celle-ci sérialise l'exécution (pas de
/// parallélisme), indispensable car tous les tests partagent la même base InMemory nommée et le
/// seeder Identity se courrouce si deux hôtes l'amorcent en même temps. Le proxy Places est
/// substitué pour répondre instantanément sans réseau.
/// </summary>
[Collection("Integration")]
public sealed class PlacesRateLimitTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;

    public PlacesRateLimitTests(WebAppFactory factory)
    {
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
        factory.PlacesService
            .SuggestAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new List<PlaceSuggestionDto>());
    }

    [Fact]
    public async Task Suggest_ExceedingWindow_Returns429()
    {
        // La fenêtre autorise 30 requêtes ; on en envoie nettement plus d'affilée pour
        // déclencher le rejet (QueueLimit = 0 → rejet immédiat au-delà du quota).
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 40; i++)
        {
            var response = await _client.GetAsync("/api/v1/places/suggest?query=Laurier");
            statuses.Add(response.StatusCode);
        }

        statuses.Should().Contain(HttpStatusCode.OK);
        statuses.Should().Contain(HttpStatusCode.TooManyRequests);
    }
}
