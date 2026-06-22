using AbrisAutoOutaouais_WebApp.Application.Places.Common;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Port (frontière Clean Architecture) vers un fournisseur d'adresses externe.
/// L'implémentation par défaut (<c>PhotonPlacesService</c>) vit dans l'Infrastructure et
/// peut être permutée par configuration seule (<c>Places:Provider</c> → Photon / Radar /
/// Google). Aucun type Infra (records de réponse provider, options) ne traverse cette
/// frontière : seuls <see cref="PlaceSuggestionDto"/> et des chaînes circulent.
/// </summary>
public interface IPlacesService
{
    /// <summary>
    /// Autocomplétion d'adresse. Renvoie une liste éventuellement vide ; ne lève JAMAIS
    /// d'exception réseau/désérialisation (résilience : un fournisseur externe indisponible
    /// ne doit pas se traduire par un 500).
    /// </summary>
    Task<IReadOnlyList<PlaceSuggestionDto>> SuggestAsync(
        string query, string? city, string? province, CancellationToken ct = default);

    /// <summary>
    /// Résolution du code postal pour une adresse civique précise. Renvoie <c>null</c> si
    /// introuvable ou en cas d'échec du fournisseur (jamais d'exception qui remonte).
    /// </summary>
    Task<string?> LookupPostalCodeAsync(
        string civicNumber, string street, string city, string province, CancellationToken ct = default);

    /// <summary>
    /// Géocode une adresse civique en coordonnées (latitude, longitude). Utilisé À LA CRÉATION d'un
    /// RDV pour l'optimisation de tournée (US-11.3). Renvoie <c>null</c> si introuvable ou en cas
    /// d'échec du fournisseur (jamais d'exception qui remonte — un géocodage manqué ne doit pas
    /// empêcher la création du RDV).
    /// </summary>
    Task<(double Lat, double Lng)?> GeocodeAsync(
        string civicNumber, string street, string city, string province, CancellationToken ct = default);
}
