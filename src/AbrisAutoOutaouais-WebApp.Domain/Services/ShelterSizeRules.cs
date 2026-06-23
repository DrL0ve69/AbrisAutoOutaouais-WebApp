using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;

namespace AbrisAutoOutaouais_WebApp.Domain.Services;

/// <summary>
/// Règles de domaine PURES validant qu'une taille configurée (longueur × hauteur dégagée) est
/// ADMISSIBLE pour un modèle d'abri paramétrique. Source UNIQUE et partagée de ces gardes (L-004) :
/// la même validation s'applique à la COMMANDE d'achat (<c>PlaceOrderCommandHandler</c>) ET à la
/// LOCATION (<c>RentalContract.CreateForModel</c>) — on ne duplique pas les règles, on les centralise.
///
/// Les quatre gardes (dans cet ordre) :
///  1. longueur dans la plage [<see cref="ShelterModel.MinLengthCm"/>, <see cref="ShelterModel.MaxLengthCm"/>] ;
///  2. longueur alignée sur le pas (<c>(len - min) % step == 0</c>) ;
///  3. hauteur dégagée parmi les options offertes (<see cref="ShelterModel.ClearHeightOptionsCm"/>) ;
///  4. combinaison (longueur × hauteur) présente dans la grille EXACTE (<see cref="ShelterModel.PriceFor"/>),
///     car la grille peut être ÉPARSE (une combinaison « dans les options » peut ne pas être tarifée).
///
/// Toute violation lève <see cref="BusinessRuleException"/> (→ HTTP 422), AVANT tout calcul de prix
/// (sinon <c>ArgumentOutOfRangeException</c> → 500 sur une saisie utilisateur). Nécessite que les
/// collections <c>Dimensions</c> ET <c>PriceEntries</c> du modèle soient chargées (<c>.Include</c>,
/// L-035) — sinon les options/lookups sont vides et la garde rejette à tort.
/// </summary>
public static class ShelterSizeRules
{
    /// <summary>
    /// Valide la taille demandée pour <paramref name="model"/> ; lève <see cref="BusinessRuleException"/>
    /// si une garde échoue. Ne calcule pas le prix : la combinaison validée est garantie présente dans
    /// la grille (le calculateur peut alors être appelé sans risque de 500).
    /// </summary>
    public static void ValidateSize(ShelterModel model, int lengthCm, int clearHeightCm)
    {
        ArgumentNullException.ThrowIfNull(model);

        // Bornes + alignement validés AVANT le lookup (sinon ArgumentOutOfRangeException → 500).
        if (lengthCm < model.MinLengthCm || lengthCm > model.MaxLengthCm)
            throw new BusinessRuleException(
                $"La longueur doit être comprise entre {model.MinLengthCm} et {model.MaxLengthCm} cm.");

        if ((lengthCm - model.MinLengthCm) % model.LengthStepCm != 0)
            throw new BusinessRuleException(
                $"La longueur doit être alignée sur le pas de {model.LengthStepCm} cm depuis {model.MinLengthCm} cm.");

        // La hauteur dégagée doit être une des options offertes par le modèle.
        if (!model.ClearHeightOptionsCm.Contains(clearHeightCm))
            throw new BusinessRuleException(
                $"La hauteur dégagée {clearHeightCm} cm n'est pas offerte pour ce modèle " +
                $"(offertes : {string.Join(", ", model.ClearHeightOptionsCm)} cm).");

        // La combinaison (longueur, hauteur) doit exister dans la grille EXACTE (grille éparse).
        if (model.PriceFor(lengthCm, clearHeightCm) is null)
            throw new BusinessRuleException(
                $"Aucun prix disponible pour la combinaison longueur {lengthCm} cm × " +
                $"hauteur dégagée {clearHeightCm} cm pour ce modèle.");
    }
}
