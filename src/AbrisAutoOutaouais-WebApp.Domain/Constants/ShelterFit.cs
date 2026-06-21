namespace AbrisAutoOutaouais_WebApp.Domain.Constants;

/// <summary>
/// Constantes métier de la SUGGESTION d'abris (EPIC 10) : à partir d'une empreinte au sol mesurée
/// (largeur × longueur en cm), on retient les modèles paramétriques compatibles et leurs longueurs
/// admissibles. Source unique partagée par le domaine, l'Application et les tests — ne pas redéfinir
/// ces valeurs ailleurs (cf. L-004).
/// </summary>
public static class ShelterFit
{
    /// <summary>
    /// Plafond métier (en cm) de la longueur SUGGÉRÉE = 40 pi. Au-delà, on ne propose plus de
    /// rallonger le modèle même si la mesure et le modèle le permettraient : 40 pi est la borne
    /// commerciale au-delà de laquelle une installation relève d'un cas sur mesure (hors suggestion
    /// automatique). 30,48 cm/pi × 40 = 1219,2 → 1219 cm (arrondi à l'entier).
    /// </summary>
    public const int MaxSuggestedLengthCm = 1219;
}
