using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Places;

/// <summary>
/// Implémentation interchangeable du port <see cref="IPlacesService"/> via Google Places
/// (<c>Places:Provider = "google"</c>). La clé API est transmise en paramètre de requête
/// <c>key</c>. Mêmes garanties que <see cref="PhotonPlacesService"/> : BaseAddress épinglée,
/// paramètres utilisateur URL-encodés, résilience (jamais d'exception qui remonte → 500).
/// Mapping best-effort de la réponse Geocoding vers <see cref="PlaceSuggestionDto"/>.
/// </summary>
internal sealed class GooglePlacesService(
    HttpClient httpClient,
    IOptions<PlacesOptions> options,
    ILogger<GooglePlacesService> logger) : IPlacesService
{
    private readonly PlacesOptions _options = options.Value;

    public async Task<IReadOnlyList<PlaceSuggestionDto>> SuggestAsync(
        string query, string? city, string? province, CancellationToken ct = default)
    {
        var terms = string.Join(' ', new[] { query, city, province }
            .Where(t => !string.IsNullOrWhiteSpace(t)));

        try
        {
            var payload = await httpClient.GetFromJsonAsync<GoogleGeocodeResponse>(BuildUri(terms), ct);
            if (payload?.Results is null)
                return [];

            return payload.Results.Select(MapToSuggestion).ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Échec de l'autocomplétion Google pour « {Query} ».", query);
            return [];
        }
    }

    public async Task<string?> LookupPostalCodeAsync(
        string civicNumber, string street, string city, string province, CancellationToken ct = default)
    {
        var terms = string.Join(' ', new[] { civicNumber, street, city, province }
            .Where(t => !string.IsNullOrWhiteSpace(t)));

        try
        {
            var payload = await httpClient.GetFromJsonAsync<GoogleGeocodeResponse>(BuildUri(terms), ct);
            return payload?.Results?
                .Select(ExtractPostalCode)
                .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Échec de la résolution du code postal Google pour « {Street} ».", street);
            return null;
        }
    }

    private string BuildUri(string terms) =>
        $"maps/api/geocode/json?address={Uri.EscapeDataString(terms)}" +
        $"&key={Uri.EscapeDataString(_options.Google.ApiKey)}";

    private static PlaceSuggestionDto MapToSuggestion(GoogleResult r)
    {
        var civic = Component(r, "street_number");
        var street = Component(r, "route");
        var city = Component(r, "locality") ?? Component(r, "administrative_area_level_2");
        var province = ComponentShort(r, "administrative_area_level_1");
        var postal = Component(r, "postal_code");

        return new PlaceSuggestionDto(
            Label: r.FormattedAddress ?? string.Empty,
            CivicNumber: civic,
            Street: street ?? string.Empty,
            City: city ?? string.Empty,
            Province: province ?? string.Empty,
            PostalCode: postal,
            Lat: r.Geometry?.Location?.Lat,
            Lng: r.Geometry?.Location?.Lng);
    }

    private static string? ExtractPostalCode(GoogleResult r) => Component(r, "postal_code");

    private static string? Component(GoogleResult r, string type) =>
        r.AddressComponents?
            .FirstOrDefault(c => c.Types is not null && c.Types.Contains(type))?
            .LongName;

    private static string? ComponentShort(GoogleResult r, string type) =>
        r.AddressComponents?
            .FirstOrDefault(c => c.Types is not null && c.Types.Contains(type))?
            .ShortName;

    // ── Records de désérialisation Google — INTERNAL, ne fuitent pas vers l'Application. ──

    private sealed record GoogleGeocodeResponse(
        [property: JsonPropertyName("results")] IReadOnlyList<GoogleResult>? Results);

    private sealed record GoogleResult(
        [property: JsonPropertyName("formatted_address")] string? FormattedAddress,
        [property: JsonPropertyName("address_components")] IReadOnlyList<GoogleAddressComponent>? AddressComponents,
        [property: JsonPropertyName("geometry")] GoogleGeometry? Geometry);

    private sealed record GoogleAddressComponent(
        [property: JsonPropertyName("long_name")] string? LongName,
        [property: JsonPropertyName("short_name")] string? ShortName,
        [property: JsonPropertyName("types")] IReadOnlyList<string>? Types);

    private sealed record GoogleGeometry(
        [property: JsonPropertyName("location")] GoogleLocation? Location);

    private sealed record GoogleLocation(
        [property: JsonPropertyName("lat")] double? Lat,
        [property: JsonPropertyName("lng")] double? Lng);
}
