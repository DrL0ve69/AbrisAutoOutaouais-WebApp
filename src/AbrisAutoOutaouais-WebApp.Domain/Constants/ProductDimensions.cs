namespace AbrisAutoOutaouais_WebApp.Domain.Constants;

/// <summary>
/// Bornes métier des dimensions hors-tout d'un produit (en centimètres).
/// Une dimension est toujours optionnelle (null = non renseignée), mais si elle est
/// fournie elle doit tenir dans cette plage. Source unique partagée par TOUS les
/// validators (Create/Update) pour qu'ils s'accordent sur le même format (cf. L-004).
/// </summary>
public static class ProductDimensions
{
    public const int MinCm = 50;
    public const int MaxCm = 2000;

    /// <summary>
    /// Marge (en cm) sous laquelle un abri suggéré est considéré « ajusté serré »
    /// (<c>IsTightFit</c>) par rapport aux dimensions requises. Source unique du seuil :
    /// ne pas redéfinir 50 ailleurs (cf. L-004).
    /// </summary>
    public const int TightFitMarginCm = 50;
}
