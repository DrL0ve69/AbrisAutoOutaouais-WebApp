using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Places;

/// <summary>
/// Implémentation interchangeable du port <see cref="IPlacesService"/> via Radar
/// (<c>Places:Provider = "radar"</c>). La clé API est transmise dans l'en-tête
/// <c>Authorization</c>. Mêmes garanties que <see cref="PhotonPlacesService"/> :
/// BaseAddress épinglée, paramètres utilisateur URL-encodés, résilience (jamais d'exception
/// qui remonte → 500). Mapping best-effort de la réponse Radar vers
/// <see cref="PlaceSuggestionDto"/>.
/// </summary>
internal sealed class RadarPlacesService(
    HttpClient httpClient,
    IOptions<PlacesOptions> options,
    ILogger<RadarPlacesService> logger) : IPlacesService
{
    private readonly PlacesOptions _options = options.Value;

    public async Task<IReadOnlyList<PlaceSuggestionDto>> SuggestAsync(
        string query, string? city, string? province, CancellationToken ct = default)
    {
        var terms = string.Join(' ', new[] { query, city, province }
            .Where(t => !string.IsNullOrWhiteSpace(t)));

        var requestUri =
            $"v1/search/autocomplete?query={Uri.EscapeDataString(terms)}" +
            $"&near={_options.BiasLat.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
            $"{_options.BiasLng.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            "&limit=5";

        try
        {
            using var request = BuildRequest(requestUri);
            using var response = await httpClient.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            var payload = await response.Content.ReadFromJsonAsync<RadarResponse>(ct);
            if (payload?.Addresses is null)
                return [];

            return payload.Addresses.Select(MapToSuggestion).ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Échec de l'autocomplétion Radar pour « {Query} ».", query);
            return [];
        }
    }

    public async Task<string?> LookupPostalCodeAsync(
        string civicNumber, string street, string city, string province, CancellationToken ct = default)
    {
        var terms = string.Join(' ', new[] { civicNumber, street, city, province }
            .Where(t => !string.IsNullOrWhiteSpace(t)));

        var requestUri =
            $"v1/search/autocomplete?query={Uri.EscapeDataString(terms)}" +
            $"&near={_options.BiasLat.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
            $"{_options.BiasLng.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            "&limit=1";

        try
        {
            using var request = BuildRequest(requestUri);
            using var response = await httpClient.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            var payload = await response.Content.ReadFromJsonAsync<RadarResponse>(ct);
            return payload?.Addresses?
                .Select(a => a.PostalCode)
                .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Échec de la résolution du code postal Radar pour « {Street} ».", street);
            return null;
        }
    }

    private HttpRequestMessage BuildRequest(string requestUri)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.TryAddWithoutValidation("Authorization", _options.Radar.ApiKey);
        return request;
    }

    private static PlaceSuggestionDto MapToSuggestion(RadarAddress a) => new(
        Label: a.FormattedAddress ?? string.Empty,
        CivicNumber: string.IsNullOrWhiteSpace(a.Number) ? null : a.Number,
        Street: a.Street ?? string.Empty,
        City: a.City ?? string.Empty,
        Province: a.StateCode ?? a.State ?? string.Empty,
        PostalCode: string.IsNullOrWhiteSpace(a.PostalCode) ? null : a.PostalCode,
        Lat: a.Latitude,
        Lng: a.Longitude);

    // ── Records de désérialisation Radar — INTERNAL, ne fuitent pas vers l'Application. ──

    private sealed record RadarResponse(
        [property: JsonPropertyName("addresses")] IReadOnlyList<RadarAddress>? Addresses);

    private sealed record RadarAddress(
        [property: JsonPropertyName("formattedAddress")] string? FormattedAddress,
        [property: JsonPropertyName("number")] string? Number,
        [property: JsonPropertyName("street")] string? Street,
        [property: JsonPropertyName("city")] string? City,
        [property: JsonPropertyName("state")] string? State,
        [property: JsonPropertyName("stateCode")] string? StateCode,
        [property: JsonPropertyName("postalCode")] string? PostalCode,
        [property: JsonPropertyName("latitude")] double? Latitude,
        [property: JsonPropertyName("longitude")] double? Longitude);
}
