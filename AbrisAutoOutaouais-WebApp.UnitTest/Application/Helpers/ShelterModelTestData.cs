using AbrisAutoOutaouais_WebApp.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;

/// <summary>
/// Fabrique de <see cref="ShelterModel"/> pour les tests, post « grille de prix exacte ».
/// L'entité ne porte plus <c>basePrice</c>/<c>pricePerArchCents</c> : le prix vient d'une GRILLE
/// (longueur × hauteur dégagée). Ce helper construit un modèle ET une grille COMPLÈTE (toutes les
/// combinaisons longueur × hauteur) dont le prix RÉPLIQUE l'ancienne formule par arches —
/// <c>priceCents = basePrice×100 + ((length-min)/step)×pricePerArchCents</c> — afin que les
/// assertions de prix explicites héritées (ex. base = 349 $, 488 cm = 799 $) restent valides tout
/// en passant désormais par le lookup. Les longueurs couvrent <c>[min, max]</c> par pas.
/// </summary>
public static class ShelterModelTestData
{
    /// <summary>
    /// Crée un modèle avec une grille COMPLÈTE (toutes les combinaisons longueur × hauteur), prix
    /// dérivé de la formule par arches (compatibilité des assertions de prix existantes).
    /// </summary>
    public static ShelterModel CreateWithGrid(
        string slug,
        string name,
        Guid categoryId,
        int lengthStepCm = 122,
        int minLengthCm = 122,
        int maxLengthCm = 1830,
        decimal basePrice = 349.00m,
        int pricePerArchCents = 15000,
        IReadOnlyList<int>? widthsCm = null,
        IReadOnlyList<int>? clearHeightsCm = null)
    {
        var widths = widthsCm ?? [335, 366];
        var heights = clearHeightsCm ?? [198];

        var grid = BuildGrid(
            minLengthCm, maxLengthCm, lengthStepCm, basePrice, pricePerArchCents, heights);

        return ShelterModel.Create(
            slug, name, categoryId,
            lengthStepCm, minLengthCm, maxLengthCm,
            widths, heights, grid);
    }

    /// <summary>
    /// Génère les entrées de grille (longueur × hauteur) pour <paramref name="heights"/> sur toute la
    /// plage <c>[min, max]</c> par pas, en répliquant la formule par arches (prix indépendant de la
    /// hauteur — suffisant pour les tests, qui n'ancrent que des prix par longueur).
    /// </summary>
    public static IReadOnlyList<ShelterModel.PriceEntryInput> BuildGrid(
        int minLengthCm,
        int maxLengthCm,
        int lengthStepCm,
        decimal basePrice,
        int pricePerArchCents,
        IReadOnlyList<int> heights)
    {
        var entries = new List<ShelterModel.PriceEntryInput>();
        for (var length = minLengthCm; length <= maxLengthCm; length += lengthStepCm)
        {
            var arches = (length - minLengthCm) / lengthStepCm;
            var priceCents = (int)(basePrice * 100) + arches * pricePerArchCents;
            foreach (var h in heights)
                entries.Add(new ShelterModel.PriceEntryInput(length, h, priceCents));
        }

        return entries;
    }
}
