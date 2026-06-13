namespace AbrisAutoOutaouais_WebApp.Domain.Constants;

/// <summary>
/// Source canonique unique des marques d'abris exclues du service d'installation/réservation.
/// Le catalogue de vente reste 100 % Tempo, mais l'installation accepte d'autres marques —
/// SAUF celles listées ici (leçon L-004 : une seule définition partagée entre toutes les
/// couches et reflétée côté client par <c>core/validators/brand.validators.ts</c>).
/// </summary>
public static class ExcludedShelterBrands
{
    /// <summary>Noms exclus, comparés sans tenir compte de la casse.</summary>
    public static readonly IReadOnlySet<string> Names =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "ShelterLogic" };

    /// <summary>
    /// Vrai si <paramref name="brand"/> (après trim, casse ignorée) figure dans la liste d'exclusion.
    /// Une marque vide/nulle n'est jamais exclue (champ optionnel).
    /// </summary>
    public static bool IsExcluded(string? brand) =>
        !string.IsNullOrWhiteSpace(brand) && Names.Contains(brand.Trim());
}
