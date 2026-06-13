using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Places;

/// <summary>
/// Implémentation par défaut du port <see cref="IPlacesService"/> via Photon (komoot),
/// service de géocodage public OpenStreetMap sans clé. Provider actif quand
/// <c>Places:Provider = "photon"</c>.
/// <para>
/// SÉCURITÉ : la <c>BaseAddress</c> du <see cref="HttpClient"/> est épinglée à la
/// configuration (jamais concaténée depuis une entrée utilisateur) et TOUS les paramètres
/// utilisateur sont URL-encodés (<see cref="Uri.EscapeDataString"/>) avant d'être insérés
/// dans la query string — pas d'injection d'URL possible.
/// </para>
/// <para>
/// RÉSILIENCE : tout échec réseau / désérialisation est capturé et journalisé en Warning ;
/// la méthode renvoie alors une liste vide (suggest) ou <c>null</c> (lookup). Aucune
/// exception ne remonte au handler → jamais de 500 à cause d'un fournisseur externe.
/// </para>
/// </summary>
internal sealed class PhotonPlacesService(
    HttpClient httpClient,
    IOptions<PlacesOptions> options,
    ILogger<PhotonPlacesService> logger) : IPlacesService
{
    private readonly PlacesOptions _options = options.Value;

    public async Task<IReadOnlyList<PlaceSuggestionDto>> SuggestAsync(
        string query, string? city, string? province, CancellationToken ct = default)
    {
        // Indices ville/province repliés dans le texte recherché (Photon n'a pas de
        // paramètre dédié) ; le biais lat/lon oriente vers Gatineau.
        var terms = string.Join(' ', new[] { query, city, province }
            .Where(t => !string.IsNullOrWhiteSpace(t)));

        var requestUri =
            $"api/?q={Uri.EscapeDataString(terms)}" +
            $"&lat={_options.BiasLat.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            $"&lon={_options.BiasLng.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            "&limit=5&lang=fr";

        try
        {
            var payload = await httpClient.GetFromJsonAsync<PhotonFeatureCollection>(requestUri, ct);
            if (payload?.Features is null)
                return [];

            return payload.Features
                .Select(MapToSuggestion)
                .ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Échec de l'autocomplétion Photon pour « {Query} ».", query);
            return [];
        }
    }

    public async Task<string?> LookupPostalCodeAsync(
        string civicNumber, string street, string city, string province, CancellationToken ct = default)
    {
        var terms = string.Join(' ', new[] { civicNumber, street, city, province }
            .Where(t => !string.IsNullOrWhiteSpace(t)));

        var requestUri =
            $"api/?q={Uri.EscapeDataString(terms)}" +
            $"&lat={_options.BiasLat.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            $"&lon={_options.BiasLng.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            "&limit=1&lang=fr";

        try
        {
            var payload = await httpClient.GetFromJsonAsync<PhotonFeatureCollection>(requestUri, ct);
            return payload?.Features?
                .Select(f => f.Properties?.PostCode)
                .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Échec de la résolution du code postal Photon pour « {Street} ».", street);
            return null;
        }
    }

    private static PlaceSuggestionDto MapToSuggestion(PhotonFeature feature)
    {
        var p = feature.Properties;
        var street = p?.Street ?? p?.Name ?? string.Empty;
        var city = p?.City ?? p?.County ?? string.Empty;
        var province = p?.State ?? string.Empty;

        // GeoJSON : coordinates = [longitude, latitude].
        double? lng = feature.Geometry?.Coordinates is { Length: >= 2 } c ? c[0] : null;
        double? lat = feature.Geometry?.Coordinates is { Length: >= 2 } c2 ? c2[1] : null;

        var label = string.Join(", ", new[]
            {
                string.Join(' ', new[] { p?.HouseNumber, street }.Where(s => !string.IsNullOrWhiteSpace(s))),
                city,
                province,
                p?.PostCode,
            }
            .Where(s => !string.IsNullOrWhiteSpace(s)));

        return new PlaceSuggestionDto(
            Label: label,
            CivicNumber: string.IsNullOrWhiteSpace(p?.HouseNumber) ? null : p!.HouseNumber,
            Street: street,
            City: city,
            Province: province,
            PostalCode: string.IsNullOrWhiteSpace(p?.PostCode) ? null : p!.PostCode,
            Lat: lat,
            Lng: lng);
    }

    // ── Records de désérialisation de la réponse Photon (GeoJSON FeatureCollection) ──
    // INTERNAL à l'Infrastructure : ces types ne traversent JAMAIS la frontière vers
    // l'Application (qui ne connaît que PlaceSuggestionDto).

    private sealed record PhotonFeatureCollection(
        [property: JsonPropertyName("features")] IReadOnlyList<PhotonFeature>? Features);

    private sealed record PhotonFeature(
        [property: JsonPropertyName("properties")] PhotonProperties? Properties,
        [property: JsonPropertyName("geometry")] PhotonGeometry? Geometry);

    private sealed record PhotonGeometry(
        [property: JsonPropertyName("coordinates")] double[]? Coordinates);

    private sealed record PhotonProperties(
        [property: JsonPropertyName("housenumber")] string? HouseNumber,
        [property: JsonPropertyName("street")] string? Street,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("city")] string? City,
        [property: JsonPropertyName("county")] string? County,
        [property: JsonPropertyName("state")] string? State,
        [property: JsonPropertyName("postcode")] string? PostCode);
}
