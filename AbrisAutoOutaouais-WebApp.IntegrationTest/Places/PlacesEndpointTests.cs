using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ClearExtensions;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Places;

/// <summary>
/// Tests de bout en bout pour /api/v1/places. Le proxy Places est substitué (aucun appel
/// réseau externe) : on vérifie le contrat HTTP, la validation (422) et le passage des
/// arguments au service.
/// </summary>
[Collection("Integration")]  // Partage WebAppFactory — pas de parallélisme
public sealed class PlacesEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public PlacesEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
        _factory.PlacesService.ClearSubstitute();
    }

    // ── GET /api/v1/places/suggest ───────────────────────────────────────────

    [Fact]
    public async Task Suggest_Anonymous_Returns200WithSuggestions()
    {
        _factory.PlacesService
            .SuggestAsync("Laurier", Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new List<PlaceSuggestionDto>
            {
                new("25 Rue Laurier, Gatineau, QC", "25", "Rue Laurier", "Gatineau", "QC", "J8X 3W6", 45.42, -75.70),
            });

        var response = await _client.GetAsync("/api/v1/places/suggest?query=Laurier&city=Gatineau&province=QC");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<PlaceSuggestionDto>>();
        body.Should().ContainSingle();
        body![0].Street.Should().Be("Rue Laurier");
        body[0].PostalCode.Should().Be("J8X 3W6");
    }

    [Fact]
    public async Task Suggest_EmptyQuery_Returns422()
    {
        var response = await _client.GetAsync("/api/v1/places/suggest?query=");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);
    }

    // ── GET /api/v1/places/lookup-postal-code ─────────────────────────────────

    [Fact]
    public async Task LookupPostalCode_Anonymous_Returns200WithPostalCode()
    {
        _factory.PlacesService
            .LookupPostalCodeAsync("25", "Rue Laurier", "Gatineau", "QC", Arg.Any<CancellationToken>())
            .Returns("J8X 3W6");

        var response = await _client.GetAsync(
            "/api/v1/places/lookup-postal-code?civicNumber=25&street=Rue%20Laurier&city=Gatineau&province=QC");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        payload.GetProperty("postalCode").GetString().Should().Be("J8X 3W6");
    }
}
