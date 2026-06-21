using AbrisAutoOutaouais_WebApp.Domain.Constants;

namespace AbrisAutoOutaouais_WebApp.Domain.Services;

/// <summary>
/// Service de domaine PUR (sans état, sans dépendance — miroir de <see cref="ShelterPriceCalculator"/>)
/// pour la SUGGESTION d'abris (EPIC 10, US-10.1). À partir d'une empreinte au sol mesurée
/// (largeur × longueur en cm), il répond à deux questions élémentaires :
///  - le modèle est-il assez étroit pour tenir dans la largeur disponible (<see cref="Fits"/>) ?
///  - quelles longueurs configurables sont admissibles (<see cref="AvailableLengths"/>) ?
///
/// Toute la logique métier de bornage vit ici (et non dans le handler) pour rester testable sans EF
/// et pour partager une source unique (cf. ShelterPriceCalculator).
/// </summary>
public static class ShelterFitCalculator
{
    /// <summary>
    /// Un modèle « rentre » en largeur si sa largeur fixe est INFÉRIEURE OU ÉGALE à la largeur
    /// requise (== passe, &gt; non). Post-EPIC 9, chaque modèle n'a qu'UNE largeur (« une largeur =
    /// un modèle »), d'où une comparaison scalaire.
    /// </summary>
    public static bool Fits(int modelWidthCm, int requiredWidthCm)
        => modelWidthCm <= requiredWidthCm;

    /// <summary>
    /// Longueurs configurables admissibles pour un modèle, en cm : <c>Min + k·Step</c> (k ≥ 0) tant
    /// que la valeur reste ≤ au PLAFOND EFFECTIF, qui combine trois bornes :
    ///  - la longueur requise (la mesure du client, <paramref name="requiredLengthCm"/>) ;
    ///  - la longueur max du modèle (<paramref name="maxLengthCm"/>) ;
    ///  - le plafond métier de 40 pi (<see cref="ShelterFit.MaxSuggestedLengthCm"/>).
    ///
    /// La longueur de BASE (<paramref name="minLengthCm"/>) doit elle-même être ≤ ce plafond, sinon
    /// AUCUNE longueur n'est admissible → liste vide (le modèle sera alors exclu de la suggestion).
    /// Liste triée croissant. Garde-fous : pas &gt; 0, min &gt; 0, requis &gt; 0.
    /// </summary>
    public static IReadOnlyList<int> AvailableLengths(
        int minLengthCm, int lengthStepCm, int maxLengthCm, int requiredLengthCm)
    {
        if (lengthStepCm <= 0)
            throw new ArgumentOutOfRangeException(
                nameof(lengthStepCm), lengthStepCm, "Le pas de longueur doit être strictement positif.");
        if (minLengthCm <= 0)
            throw new ArgumentOutOfRangeException(
                nameof(minLengthCm), minLengthCm, "La longueur minimale doit être strictement positive.");
        if (requiredLengthCm <= 0)
            throw new ArgumentOutOfRangeException(
                nameof(requiredLengthCm), requiredLengthCm, "La longueur requise doit être strictement positive.");

        // Plafond effectif = la plus contraignante des trois bornes.
        var cap = Math.Min(requiredLengthCm, Math.Min(maxLengthCm, ShelterFit.MaxSuggestedLengthCm));

        var lengths = new List<int>();
        for (var length = minLengthCm; length <= cap; length += lengthStepCm)
            lengths.Add(length);

        return lengths;
    }
}
