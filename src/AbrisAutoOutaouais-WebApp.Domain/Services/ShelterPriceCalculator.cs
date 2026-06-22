using AbrisAutoOutaouais_WebApp.Domain.Entities;

namespace AbrisAutoOutaouais_WebApp.Domain.Services;

/// <summary>
/// Service de domaine PUR (sans état, sans dépendance) : résout le prix EXACT d'un abri paramétrique
/// pour une combinaison (longueur × hauteur dégagée) par LOOKUP dans la grille de prix semée du
/// modèle (<see cref="ShelterModel.PriceFor"/>). La tarification n'est plus une formule linéaire :
/// elle dépend des trois axes (modèle × longueur × hauteur dégagée) et peut être ÉPARSE — certaines
/// combinaisons n'existent pas (ex. double-rond).
/// </summary>
public static class ShelterPriceCalculator
{
    /// <summary>
    /// Prix total (en dollars) pour la combinaison configurée, par lookup dans la grille du modèle.
    ///
    /// Si la combinaison (longueur, hauteur) n'existe PAS dans la grille → lève
    /// <see cref="ArgumentOutOfRangeException"/>. Ce contrat est PRÉSERVÉ : les handlers amont
    /// (<c>GetShelterPriceQueryHandler</c>, <c>PlaceOrderCommandHandler</c>) valident la combinaison
    /// AVANT d'appeler ce calculateur et traduisent l'absence en 422 propre (sinon 500 non géré).
    ///
    /// Nécessite que <see cref="ShelterModel.PriceEntries"/> soit chargée (<c>.Include</c>) — une
    /// grille non chargée donne 0 entrée → lookup nul → exception (L-035).
    /// </summary>
    public static decimal CalculatePrice(ShelterModel model, int lengthCm, int clearHeightCm)
    {
        ArgumentNullException.ThrowIfNull(model);

        var priceCents = model.PriceFor(lengthCm, clearHeightCm)
            ?? throw new ArgumentOutOfRangeException(
                nameof(lengthCm),
                lengthCm,
                $"Aucun prix pour la combinaison longueur {lengthCm} cm × hauteur {clearHeightCm} cm.");

        return priceCents / 100m;
    }
}
