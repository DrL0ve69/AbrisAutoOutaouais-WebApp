using AbrisAutoOutaouais_WebApp.Domain.Enums;

namespace AbrisAutoOutaouais_WebApp.Domain.Services;

/// <summary>
/// Règle de domaine PURE : barème FORFAITAIRE (CAD) d'une intervention selon son <see cref="BookingType"/>
/// (EPIC 7.3). Source UNIQUE du montant facturé à la réservation — le handler de création appelle
/// <see cref="ForType"/> et SNAPSHOTe le résultat sur le <c>BookingSlot</c> (comme <c>Order.Total</c> /
/// <c>RentalContract.MonthlyRate</c>). Implémenté comme un patron Strategy minimal (un <c>switch</c>
/// d'expression sur l'enum), pour rester ouvert à l'extension sans grossir le handler (OCP, cf.
/// design-patterns.md) : si le barème devenait dynamique (admin), on remplacerait cette table par un
/// lookup en base derrière la même signature.
/// </summary>
public static class BookingPricing
{
    /// <summary>Montant forfaitaire (CAD) pour le type d'intervention donné.</summary>
    public static decimal ForType(BookingType type) => type switch
    {
        BookingType.Installation => 150m,
        BookingType.Delivery => 75m,
        BookingType.Removal => 100m,
        _ => throw new ArgumentOutOfRangeException(
            nameof(type), type, "Type de réservation inconnu pour le barème forfaitaire."),
    };
}
