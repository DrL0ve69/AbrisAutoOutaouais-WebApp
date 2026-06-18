using AbrisAutoOutaouais_WebApp.Domain.Entities;

namespace AbrisAutoOutaouais_WebApp.Domain.Services;

/// <summary>
/// Service de domaine PUR (sans état, sans dépendance) : calcule le prix d'un abri paramétrique
/// pour une longueur configurée. Tarification par ARCHES :
///   <c>archCount = (lengthCm - minLengthCm) / lengthStepCm</c>
///   <c>total     = basePrice + archCount * (pricePerArchCents / 100m)</c>
/// </summary>
public static class ShelterPriceCalculator
{
    /// <summary>
    /// Nombre d'arches supplémentaires pour une longueur donnée.
    ///
    /// INVARIANT ÉPINGLÉ (L-007) : la longueur de BASE est <c>MinLengthCm</c> — à cette longueur
    /// le nombre d'arches supplémentaires est 0 (on ne paie que le <c>BasePrice</c>). Chaque pas
    /// (<c>LengthStepCm</c>) au-delà du minimum ajoute exactement une arche. Si cet invariant
    /// changeait (base ≠ min), toute cette formule — et le seed/validation amont — seraient à revoir.
    ///
    /// Garde-fou : la longueur doit être DANS la plage [Min, Max] ET alignée sur le pas
    /// (mesurée depuis <c>MinLengthCm</c>) ; sinon <see cref="ArgumentOutOfRangeException"/>.
    /// </summary>
    public static int ArchCount(ShelterModel model, int lengthCm)
    {
        ArgumentNullException.ThrowIfNull(model);

        if (lengthCm < model.MinLengthCm || lengthCm > model.MaxLengthCm)
            throw new ArgumentOutOfRangeException(
                nameof(lengthCm),
                lengthCm,
                $"La longueur doit être comprise entre {model.MinLengthCm} et {model.MaxLengthCm} cm.");

        var offset = lengthCm - model.MinLengthCm;
        if (offset % model.LengthStepCm != 0)
            throw new ArgumentOutOfRangeException(
                nameof(lengthCm),
                lengthCm,
                $"La longueur doit être alignée sur le pas de {model.LengthStepCm} cm depuis {model.MinLengthCm} cm.");

        return offset / model.LengthStepCm;
    }

    /// <summary>
    /// Prix total (en dollars) pour la longueur configurée :
    /// <c>BasePrice + ArchCount * (PricePerArchCents / 100m)</c>.
    /// </summary>
    public static decimal CalculatePrice(ShelterModel model, int lengthCm)
    {
        ArgumentNullException.ThrowIfNull(model);

        var arches = ArchCount(model, lengthCm);
        return model.BasePrice + arches * (model.PricePerArchCents / 100m);
    }
}
