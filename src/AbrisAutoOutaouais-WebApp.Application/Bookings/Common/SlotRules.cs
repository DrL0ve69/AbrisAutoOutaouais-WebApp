using System;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Common;

/// <summary>
/// Règles partagées du calendrier de créneaux : jours ouvrés, 08 h–17 h, blocs de 2 h.
/// Source unique pour la génération des créneaux disponibles ET la validation d'un report
/// (un seul endroit à modifier si les horaires d'affaires changent — voir leçon L-004).
/// </summary>
public static class SlotRules
{
    public static readonly TimeSpan WorkStart = TimeSpan.FromHours(8);
    public static readonly TimeSpan WorkEnd = TimeSpan.FromHours(17);
    public static readonly TimeSpan SlotDuration = TimeSpan.FromHours(2);

    /// <summary>
    /// Vrai si <paramref name="slotStartUtc"/> est un début de créneau valide : jour ouvré,
    /// entièrement compris dans 08 h–17 h (UTC) et aligné sur la grille de 2 h depuis 08 h.
    /// </summary>
    public static bool IsValidSlotStart(DateTime slotStartUtc)
    {
        if (slotStartUtc.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            return false;

        var timeOfDay = slotStartUtc.TimeOfDay;
        if (timeOfDay < WorkStart || timeOfDay + SlotDuration > WorkEnd)
            return false;

        // Aligné sur la grille (08 h, 10 h, 12 h, 14 h…) — comparaison en ticks (exacte).
        return (timeOfDay - WorkStart).Ticks % SlotDuration.Ticks == 0;
    }

    /// <summary>Vrai si les deux intervalles [start, start+durée) se chevauchent.</summary>
    public static bool Overlaps(DateTime aStart, int aDurationMin, DateTime bStart, int bDurationMin)
        => aStart < bStart.AddMinutes(bDurationMin) && bStart < aStart.AddMinutes(aDurationMin);
}
