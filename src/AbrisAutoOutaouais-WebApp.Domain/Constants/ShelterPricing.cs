namespace AbrisAutoOutaouais_WebApp.Domain.Constants;

/// <summary>
/// Constantes de tarification des modèles d'abris paramétriques.
/// Source unique partagée par le domaine, le seed et (en 9.2) le calcul de prix exposé —
/// ne pas redéfinir ces valeurs ailleurs (cf. L-004).
/// </summary>
public static class ShelterPricing
{
    /// <summary>
    /// Prix par arche supplémentaire, en CENTS (15 000 ¢ = 150,00 $). Stocké en entier pour éviter
    /// toute imprécision décimale sur la multiplication par le nombre d'arches.
    /// </summary>
    public const int DefaultPricePerArchCents = 15000;
}
