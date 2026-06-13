namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Places;

/// <summary>
/// Options du proxy Places, bindées sur la section <c>Places</c> de la configuration
/// (même idiome options-bound que le reste de l'Infrastructure). Le fournisseur actif est
/// choisi par <see cref="Provider"/> ; permuter Photon → Radar → Google se fait par
/// configuration seule (changer <c>Provider</c> + la clé du fournisseur correspondant).
/// <para>
/// <see cref="BiasLat"/> / <see cref="BiasLng"/> orientent les suggestions autour de
/// Gatineau (région desservie) sans restreindre les résultats hors région.
/// </para>
/// </summary>
public sealed class PlacesOptions
{
    /// <summary>« photon » (défaut, sans clé) | « radar » | « google ».</summary>
    public string Provider { get; set; } = "photon";

    /// <summary>Latitude du biais géographique (Gatineau).</summary>
    public double BiasLat { get; set; }

    /// <summary>Longitude du biais géographique (Gatineau).</summary>
    public double BiasLng { get; set; }

    public PhotonProviderOptions Photon { get; set; } = new();
    public RadarProviderOptions Radar { get; set; } = new();
    public GoogleProviderOptions Google { get; set; } = new();
}

/// <summary>Photon (komoot) — service public sans clé.</summary>
public sealed class PhotonProviderOptions
{
    public string BaseUrl { get; set; } = string.Empty;
}

/// <summary>Radar — clé transmise via l'en-tête <c>Authorization</c>.</summary>
public sealed class RadarProviderOptions
{
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
}

/// <summary>Google Places — clé transmise en paramètre de requête <c>key</c>.</summary>
public sealed class GoogleProviderOptions
{
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
}
