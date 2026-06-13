using System.Net;
using System.Text;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services.Places;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Places;

/// <summary>
/// Tests du fournisseur Photon par défaut : mapping GeoJSON → <see cref="PlaceSuggestionDto"/>,
/// résilience (réseau / JSON malformé → liste vide, jamais d'exception) et URL-encodage des
/// paramètres utilisateur sortants. Le <see cref="HttpClient"/> est piloté par un handler stub
/// qui capture la requête et renvoie une réponse contrôlée — aucun appel réseau réel.
/// </summary>
public sealed class PhotonPlacesServiceTests
{
    private static readonly PlacesOptions Options = new()
    {
        Provider = "photon",
        BiasLat = 45.483,
        BiasLng = -75.650,
        Photon = new PhotonProviderOptions { BaseUrl = "https://photon.komoot.io/" },
    };

    private const string ValidPayload = """
    {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": { "type": "Point", "coordinates": [-75.7013, 45.4215] },
          "properties": {
            "housenumber": "25",
            "street": "Rue Laurier",
            "city": "Gatineau",
            "state": "Québec",
            "postcode": "J8X 3W6"
          }
        }
      ]
    }
    """;

    private static PhotonPlacesService CreateService(StubHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri(Options.Photon.BaseUrl) },
            new OptionsWrapper<PlacesOptions>(Options),
            NullLogger<PhotonPlacesService>.Instance);

    [Fact]
    public async Task SuggestAsync_ValidPayload_MapsAllFields()
    {
        var handler = new StubHandler(ValidPayload);
        var service = CreateService(handler);

        var result = await service.SuggestAsync("Laurier", "Gatineau", "QC", TestContext.Current.CancellationToken);

        result.Should().HaveCount(1);
        var dto = result[0];
        dto.CivicNumber.Should().Be("25");
        dto.Street.Should().Be("Rue Laurier");
        dto.City.Should().Be("Gatineau");
        dto.Province.Should().Be("Québec");
        dto.PostalCode.Should().Be("J8X 3W6");
        // GeoJSON : coordinates = [lng, lat] → Lat/Lng correctement inversés.
        dto.Lat.Should().Be(45.4215);
        dto.Lng.Should().Be(-75.7013);
        dto.Label.Should().Contain("25 Rue Laurier").And.Contain("Gatineau");
    }

    [Fact]
    public async Task SuggestAsync_UrlEncodesUserInput()
    {
        var handler = new StubHandler(ValidPayload);
        var service = CreateService(handler);

        await service.SuggestAsync("Rue de l'Église & 1er", null, null, TestContext.Current.CancellationToken);

        handler.LastRequestUri.Should().NotBeNull();
        // On lit la query string BRUTE (AbsoluteUri/Query préservent les séquences encodées,
        // contrairement à ToString() qui ré-affiche %20 en espace). Le « & » et l'apostrophe
        // saisis par l'utilisateur DOIVENT rester encodés : sinon un « & » brut découperait
        // un nouveau paramètre (injection d'URL).
        var rawQuery = handler.LastRequestUri!.Query;
        rawQuery.Should().Contain("%26");                 // & encodé
        rawQuery.Should().Contain("%27");                 // apostrophe encodée
        // Isole la valeur brute du paramètre q (entre « q= » et le premier « & » séparateur).
        // Elle ne doit contenir AUCUN « & » non encodé : sinon l'entrée utilisateur aurait
        // injecté un nouveau paramètre (faille d'injection d'URL).
        var rawQValue = rawQuery["?q=".Length..rawQuery.IndexOf("&lat=", StringComparison.Ordinal)];
        rawQValue.Should().NotContain("&");
        Uri.UnescapeDataString(rawQValue).Should().Be("Rue de l'Église & 1er");
    }

    [Fact]
    public async Task SuggestAsync_NetworkError_ReturnsEmptyWithoutThrowing()
    {
        var handler = new StubHandler(new HttpRequestException("réseau indisponible"));
        var service = CreateService(handler);

        var act = async () => await service.SuggestAsync("Laurier", null, null, TestContext.Current.CancellationToken);

        var result = await act.Should().NotThrowAsync();
        result.Subject.Should().BeEmpty();
    }

    [Fact]
    public async Task SuggestAsync_MalformedJson_ReturnsEmptyWithoutThrowing()
    {
        var handler = new StubHandler("{ ceci n'est pas du JSON valide ");
        var service = CreateService(handler);

        var result = await service.SuggestAsync("Laurier", null, null, TestContext.Current.CancellationToken);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task LookupPostalCodeAsync_ValidPayload_ReturnsPostalCode()
    {
        var handler = new StubHandler(ValidPayload);
        var service = CreateService(handler);

        var postal = await service.LookupPostalCodeAsync(
            "25", "Rue Laurier", "Gatineau", "QC", TestContext.Current.CancellationToken);

        postal.Should().Be("J8X 3W6");
    }

    [Fact]
    public async Task LookupPostalCodeAsync_NetworkError_ReturnsNullWithoutThrowing()
    {
        var handler = new StubHandler(new HttpRequestException("boom"));
        var service = CreateService(handler);

        var postal = await service.LookupPostalCodeAsync(
            "25", "Rue Laurier", "Gatineau", "QC", TestContext.Current.CancellationToken);

        postal.Should().BeNull();
    }

    /// <summary>
    /// Handler stub : capture l'URI de la dernière requête et renvoie soit un corps fixe,
    /// soit lève l'exception fournie (simulation d'échec réseau).
    /// </summary>
    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly string? _body;
        private readonly Exception? _exception;

        public StubHandler(string body) => _body = body;
        public StubHandler(Exception exception) => _exception = exception;

        public Uri? LastRequestUri { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequestUri = request.RequestUri;

            if (_exception is not null)
                throw _exception;

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_body!, Encoding.UTF8, "application/json"),
            });
        }
    }
}
