using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using Domain.ValueObjects;

namespace Domain.Entities;

/// <summary>
/// Créneau d'installation, livraison ou démontage.
/// CustomerId = Guid référençant AppUser.Id.
/// </summary>
public sealed class BookingSlot : ISoftDeletable, IAuditableEntity
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid? OrderId { get; private set; }
    public DateTime SlotStart { get; private set; }
    public int DurationMin { get; private set; }
    public BookingType Type { get; private set; }
    public BookingStatus Status { get; private set; }
    public Address Address { get; private set; } = null!;
    public string? Notes { get; private set; }

    /// <summary>Marque de l'abri à installer (optionnel ; null pour un Tempo ou une résa sans marque).</summary>
    public string? Brand { get; private set; }

    /// <summary>Modèle de l'abri (optionnel).</summary>
    public string? Model { get; private set; }

    /// <summary>
    /// Latitude du lieu du RDV (degrés décimaux), géocodée À LA CRÉATION via le port de géocodage
    /// (US-11.3). <c>null</c> si le géocodage a échoué ou pour les RDV créés avant cette fonctionnalité ;
    /// un RDV sans coordonnées est exclu de l'optimisation de tournée (pas de backfill automatique).
    /// </summary>
    public double? Lat { get; private set; }

    /// <summary>Longitude du lieu du RDV (degrés décimaux). Voir <see cref="Lat"/>.</summary>
    public double? Lng { get; private set; }

    /// <summary>
    /// Montant FORFAITAIRE (CAD) facturé pour cette intervention, SNAPSHOTé à la création depuis le
    /// barème par type (<see cref="Domain.Services.BookingPricing"/>). Symétrie avec <c>Order.Total</c>
    /// et <c>RentalContract.MonthlyRate</c> ; mappé <c>decimal(18,2)</c> (EPIC 7.3).
    /// </summary>
    public decimal Amount { get; private set; }

    /// <summary>
    /// Information de paiement (Owned VO <see cref="PaymentInfo"/>, colonnes <c>Payment_*</c>). NULLABLE :
    /// les réservations antérieures à la migration EPIC 7.3 n'en portent pas, et l'agrégat est créé sans
    /// paiement (la référence est attachée juste après par <see cref="AttachPaymentReference"/>).
    /// Calque <c>RentalContract.Payment</c>.
    /// </summary>
    public PaymentInfo? Payment { get; private set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private BookingSlot() { }

    public static BookingSlot Create(
        Guid customerId, DateTime slotStart, int durationMin,
        BookingType type, Address address,
        Guid? orderId = null, string? notes = null,
        string? brand = null, string? model = null,
        double? lat = null, double? lng = null,
        decimal amount = 0m)
    {
        if (slotStart <= DateTime.UtcNow)
            throw new BusinessRuleException("Le créneau doit être dans le futur.");
        if (durationMin <= 0)
            throw new ArgumentException("Durée doit être positive.");

        var trimmedBrand = string.IsNullOrWhiteSpace(brand) ? null : brand.Trim();
        var trimmedModel = string.IsNullOrWhiteSpace(model) ? null : model.Trim();

        // Invariant agrégat : le service d'installation refuse ShelterLogic (leçon L-004).
        if (ExcludedShelterBrands.IsExcluded(trimmedBrand))
            throw new BusinessRuleException("Nous n'installons pas la marque ShelterLogic.");

        return new BookingSlot
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            OrderId = orderId,
            SlotStart = slotStart,
            DurationMin = durationMin,
            Type = type,
            // Statut INITIAL : en attente du paiement (virement Interac, EPIC 7.3). La réservation n'est
            // CONFIRMÉE qu'après réconciliation administrative du paiement (Activate). Miroir de
            // RentalContract.CreateForModel → RentalStatus.PendingPayment.
            Status = BookingStatus.PendingPayment,
            Address = address,
            Notes = notes?.Trim(),
            Brand = trimmedBrand,
            Model = trimmedModel,
            // Coordonnées géocodées à la création (US-11.3) — null si le géocodage a échoué.
            Lat = lat,
            Lng = lng,
            // Montant forfaitaire snapshoté (barème par type) — facturé via le virement Interac.
            Amount = amount,
        };
    }

    /// <summary>
    /// Renseigne (ou efface) les coordonnées géographiques du lieu du RDV. Appelé par le handler
    /// de création après géocodage, ou pour corriger des coordonnées. Les deux valeurs vont de pair.
    /// </summary>
    public void SetCoordinates(double? lat, double? lng)
    {
        Lat = lat;
        Lng = lng;
    }

    /// <summary>
    /// Confirme une réservation HÉRITÉE <see cref="BookingStatus.Pending"/> (action admin « confirm »,
    /// avant EPIC 7). Ne s'applique QU'aux réservations historiques nées <c>Pending</c> : depuis EPIC 7.3,
    /// les nouvelles réservations naissent <see cref="BookingStatus.PendingPayment"/> (virement Interac)
    /// et sont confirmées par la RÉCONCILIATION de paiement (<see cref="Activate"/>), jamais par cette
    /// méthode. Conservée pour le parc historique <c>Pending</c> (cf. L-054).
    /// </summary>
    public void Confirm()
    {
        if (Status != BookingStatus.Pending)
            throw new BusinessRuleException("Seul un créneau en attente peut être confirmé.");
        Status = BookingStatus.Confirmed;
    }

    /// <summary>
    /// Attache une référence de paiement (virement Interac) à la réservation, en posant un
    /// <see cref="PaymentInfo"/> EN ATTENTE. Garde : seulement tant que la réservation est en attente de
    /// paiement (<see cref="BookingStatus.PendingPayment"/>) — on n'altère pas le paiement d'une
    /// réservation déjà confirmée. Calque <c>RentalContract.AttachPaymentReference</c> (EPIC 7.3).
    /// </summary>
    public void AttachPaymentReference(string reference)
    {
        if (Status != BookingStatus.PendingPayment)
            throw new BusinessRuleException(
                "Une référence de paiement ne peut être attachée qu'à une réservation en attente de paiement.");
        Payment = PaymentInfo.Pending(reference);
    }

    /// <summary>
    /// Active la réservation après RÉCONCILIATION du paiement : confirme le paiement
    /// (<see cref="PaymentInfo.Confirm"/>) PUIS passe le statut à <see cref="BookingStatus.Confirmed"/>.
    /// Gardes (L-046, défense en profondeur — calque <c>RentalContract.Activate</c>) :
    ///  - aucune référence de paiement attachée → lève ;
    ///  - paiement déjà confirmé → lève (un 2ᵉ appel donne un 422, idempotence) ;
    ///  - statut non-<see cref="BookingStatus.PendingPayment"/> → lève.
    /// Le paiement est confirmé AVANT le statut : si une garde lève, l'horodatage de paiement n'aura pas
    /// été posé sur une réservation non activable.
    /// </summary>
    public void Activate(DateTime nowUtc)
    {
        if (Payment is null)
            throw new BusinessRuleException(
                "Aucune référence de paiement n'est attachée à cette réservation.");

        // Invariant porté par le paiement lui-même (et pas seulement par le statut) : un paiement déjà
        // confirmé ne se re-confirme pas — défense en profondeur (L-046).
        if (Payment.ConfirmedAt is not null)
            throw new BusinessRuleException("Le paiement de cette réservation est déjà confirmé.");

        if (Status != BookingStatus.PendingPayment)
            throw new BusinessRuleException(
                "Seule une réservation en attente de paiement peut être activée.");

        var confirmedPayment = Payment.Confirm(nowUtc);
        Status = BookingStatus.Confirmed;
        Payment = confirmedPayment;
    }

    public void Cancel()
    {
        if (Status == BookingStatus.Completed)
            throw new BusinessRuleException("Un créneau complété ne peut pas être annulé.");
        if (Status == BookingStatus.Cancelled)
            throw new BusinessRuleException("Ce créneau est déjà annulé.");
        Status = BookingStatus.Cancelled;
    }

    public void Complete()
    {
        if (Status != BookingStatus.Confirmed)
            throw new BusinessRuleException("Seul un créneau confirmé peut être marqué complété.");
        Status = BookingStatus.Completed;
    }

    /// <summary>
    /// Reporte la réservation sur un nouveau créneau. Seule une réservation à venir
    /// (« Pending » ou « Confirmed ») est reportable ; le statut est conservé. La
    /// disponibilité du créneau cible est vérifiée en amont par le handler.
    /// </summary>
    public void Reschedule(DateTime newSlotStart, DateTime nowUtc)
    {
        if (Status is BookingStatus.Cancelled or BookingStatus.Completed)
            throw new BusinessRuleException("Seule une réservation à venir peut être reportée.");
        if (newSlotStart <= nowUtc)
            throw new BusinessRuleException("Le nouveau créneau doit être dans le futur.");
        SlotStart = newSlotStart;
    }
}