namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Places;

/// <summary>
/// Source canonique de normalisation province/territoire → code ISO à 2 lettres, INTERNE à la
/// couche Infrastructure Places.
/// <para>
/// RAISON D'ÊTRE (leçon L-004) : <c>AddressDtoValidator</c> (Application) impose
/// <c>Province.MaximumLength(2)</c>. Or certains fournisseurs renvoient la province en NOM
/// COMPLET — Photon (komoot/OSM, le provider par défaut sans clé) mappe <c>state</c> en
/// « Québec »/« Ontario », pas en « QC »/« ON ». Patché tel quel dans le formulaire puis soumis,
/// ça produit un <c>422</c> silencieux sur le happy-path autofill. Radar (<c>stateCode</c>) et
/// Google (<c>short_name</c>) renvoient déjà 2 lettres ; seul Photon doit être normalisé.
/// </para>
/// <para>
/// FRONTIÈRE (Clean Architecture) : c'est un détail de format de réponse d'un service externe —
/// le Domaine ignore tout des fournisseurs géocodeurs. La table vit donc en Infrastructure, près
/// des mappers qui la consomment, et ne traverse jamais vers Application/Domain.
/// </para>
/// </summary>
internal static class CanadianProvinceCodes
{
    /// <summary>
    /// Noms (variantes FR ET EN) → code ISO 3166-2:CA, casse ignorée. Couvre les 13
    /// provinces/territoires. Les codes eux-mêmes sont inclus pour absorber une réponse déjà
    /// abrégée sans la déformer.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string> ByName =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // Alberta
            ["Alberta"] = "AB",
            // Colombie-Britannique
            ["Colombie-Britannique"] = "BC",
            ["British Columbia"] = "BC",
            // Manitoba
            ["Manitoba"] = "MB",
            // Nouveau-Brunswick
            ["Nouveau-Brunswick"] = "NB",
            ["New Brunswick"] = "NB",
            // Terre-Neuve-et-Labrador
            ["Terre-Neuve-et-Labrador"] = "NL",
            ["Terre-Neuve-et-Labrador (Terre-Neuve)"] = "NL",
            ["Newfoundland and Labrador"] = "NL",
            // Nouvelle-Écosse
            ["Nouvelle-Écosse"] = "NS",
            ["Nova Scotia"] = "NS",
            // Territoires du Nord-Ouest
            ["Territoires du Nord-Ouest"] = "NT",
            ["Northwest Territories"] = "NT",
            // Nunavut
            ["Nunavut"] = "NU",
            // Ontario
            ["Ontario"] = "ON",
            // Île-du-Prince-Édouard
            ["Île-du-Prince-Édouard"] = "PE",
            ["Prince Edward Island"] = "PE",
            // Québec
            ["Québec"] = "QC",
            ["Quebec"] = "QC",
            // Saskatchewan
            ["Saskatchewan"] = "SK",
            // Yukon
            ["Yukon"] = "YT",
        };

    /// <summary>
    /// Normalise un libellé de province (nom complet FR/EN ou code) en code à 2 lettres.
    /// Trim + insensible à la casse. Si déjà un code à 2 lettres : conservé en majuscules.
    /// Si nom connu : code mappé. Si inconnu : on renvoie une valeur raisonnable (tronquée à
    /// 2 caractères en majuscules) plutôt que d'inventer — le validateur n'exige qu'une longueur
    /// ≤ 2, pas une liste blanche (leçon L-004 : ne pas refermer l'ensemble des provinces).
    /// Entrée vide/nulle → chaîne vide.
    /// </summary>
    public static string Normalize(string? province)
    {
        if (string.IsNullOrWhiteSpace(province))
            return string.Empty;

        var trimmed = province.Trim();

        if (ByName.TryGetValue(trimmed, out var code))
            return code;

        // Déjà un code à 2 lettres (« qc », « ON ») : normaliser la casse.
        if (trimmed.Length == 2)
            return trimmed.ToUpperInvariant();

        // Inconnu (ni nom mappé, ni code) : valeur raisonnable, sans inventer un code faux.
        return trimmed[..Math.Min(2, trimmed.Length)].ToUpperInvariant();
    }
}
