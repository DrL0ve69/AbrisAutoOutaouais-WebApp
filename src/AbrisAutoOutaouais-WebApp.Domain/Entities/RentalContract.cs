using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using Domain.ValueObjects;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Contrat de location d'un abri temporaire.
/// CustomerId = Guid référençant AppUser.Id.
///
/// La location ne repose plus sur un <see cref="Product"/> fixe louable : un contrat référence
/// désormais un <see cref="ShelterModel"/> paramétrique LOUABLE (tarif mensuel non nul) et une TAILLE
/// configurée (longueur × hauteur dégagée) valide au regard de la grille du modèle. <see cref="ProductId"/>
/// reste NULLABLE pour conserver les contrats HISTORIQUES créés contre un produit ; les nouveaux
/// contrats le laissent à <c>null</c> et renseignent <see cref="ShelterModelSlug"/> +
/// <see cref="ConfiguredLengthCm"/>/<see cref="ConfiguredClearHeightCm"/>.
/// </summary>
public sealed class RentalContract : ISoftDeletable, IAuditableEntity
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }

    /// <summary>
    /// Produit loué — NULLABLE : renseigné uniquement pour les contrats HISTORIQUES créés via l'ancien
    /// chemin produit. Les nouveaux contrats (modèle paramétrique) le laissent <c>null</c>.
    /// </summary>
    public Guid? ProductId { get; private set; }

    public string ProductName { get; private set; } = string.Empty; // snapshot
    public decimal MonthlyRate { get; private set; }

    /// <summary>Slug du <see cref="ShelterModel"/> loué (snapshot) — null pour les contrats historiques produit.</summary>
    public string? ShelterModelSlug { get; private set; }

    /// <summary>Longueur configurée en cm (snapshot) — null pour les contrats historiques produit.</summary>
    public int? ConfiguredLengthCm { get; private set; }

    /// <summary>Hauteur dégagée configurée en cm (snapshot) — null pour les contrats historiques produit.</summary>
    public int? ConfiguredClearHeightCm { get; private set; }

    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public RentalStatus Status { get; private set; }
    public Address Address { get; private set; } = null!;  // adresse d'installation

    /// <summary>
    /// Nombre de mois FACTURÉS du contrat — convention « tout mois entamé compte pour un mois plein »,
    /// minimum 1. C'est le nombre de mois calendaires entiers entre <see cref="StartDate"/> et
    /// <see cref="EndDate"/>, MAJORÉ d'un mois si la fin tombe après le jour du mois de début (mois
    /// partiel arrondi au mois plein). <see cref="CreateForModel"/> garantit
    /// <c>EndDate &gt; StartDate</c>, donc le résultat est toujours ≥ 1.
    /// Exemples (tarif 100 $/mois) : 2026-07-01 → 2026-10-01 = 3 mois ; 2026-07-01 → 2026-09-15 = 3 mois
    /// (mois partiel arrondi) ; 2026-07-01 → 2026-07-15 = 1 mois (durée &lt; 1 mois → min 1).
    /// </summary>
    private int MonthsBilled
    {
        get
        {
            var months = (EndDate.Year - StartDate.Year) * 12 + (EndDate.Month - StartDate.Month);
            if (EndDate.Day > StartDate.Day) months++;     // mois entamé → mois plein
            return Math.Max(1, months);
        }
    }

    /// <summary>
    /// Montant TOTAL (CAD) du contrat dû d'avance par le client : tarif mensuel SNAPSHOTé
    /// (<see cref="MonthlyRate"/>) × nombre de mois facturés (<see cref="MonthsBilled"/>). Décision
    /// propriétaire (EPIC 7.2) : pour activer une location par virement Interac, le client vire le
    /// TOTAL du contrat d'avance, pas un seul mois. Dérivé sans colonne ni migration (les bornes de
    /// date et le tarif sont déjà snapshotés). Symétrie avec <c>Order.Total</c> /
    /// <c>BookingSlot.Amount</c> comme « montant à payer ».
    /// </summary>
    public decimal TotalAmount => MonthlyRate * MonthsBilled;

    /// <summary>
    /// Information de paiement (Owned VO <see cref="PaymentInfo"/>, colonnes <c>Payment_*</c>). NULLABLE :
    /// les contrats antérieurs à la migration EPIC 7.2 n'en portent pas, et l'agrégat est créé sans
    /// paiement (la référence est attachée juste après par <see cref="AttachPaymentReference"/>).
    /// Calque <c>Order.Payment</c>.
    /// </summary>
    public PaymentInfo? Payment { get; private set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private RentalContract() { }

    /// <summary>
    /// Crée un contrat de location pour un <see cref="ShelterModel"/> paramétrique LOUABLE et une taille
    /// configurée. Gardes (dans cet ordre) :
    ///  - le modèle doit être louable (<see cref="ShelterModel.MonthlyRentalCents"/> non nul) ;
    ///  - la taille (longueur × hauteur dégagée) doit être admissible — déléguée à la source UNIQUE
    ///    <see cref="ShelterSizeRules.ValidateSize"/>, partagée avec le chemin d'achat (L-004) ;
    ///  - la date de fin doit être après la date de début.
    /// Toute violation lève <see cref="BusinessRuleException"/> (→ 422), comme le chemin d'achat.
    /// Le tarif est SNAPSHOTé (forfait mensuel, indépendant de la taille) ainsi que le nom, le slug et
    /// les dimensions configurées. <see cref="ProductId"/> reste <c>null</c> (pas de produit sous-jacent).
    /// Nécessite que les collections <c>Dimensions</c>/<c>PriceEntries</c> du modèle soient chargées
    /// (<c>.Include</c>, L-035) pour que la validation de taille soit correcte.
    /// </summary>
    public static RentalContract CreateForModel(
        Guid customerId, ShelterModel model,
        int lengthCm, int clearHeightCm,
        DateOnly startDate, DateOnly endDate, Address address)
    {
        ArgumentNullException.ThrowIfNull(model);

        if (model.MonthlyRentalCents is null)
            throw new BusinessRuleException($"« {model.Name} » n'est pas disponible à la location.");

        // Validation de la taille par la source partagée avec l'achat (bornes, pas, hauteur offerte,
        // combinaison tarifée) — mêmes 422 que PlaceOrder, jamais de règles dupliquées (L-004).
        ShelterSizeRules.ValidateSize(model, lengthCm, clearHeightCm);

        if (endDate <= startDate)
            throw new BusinessRuleException("La date de fin doit être après la date de début.");

        return new RentalContract
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            ProductId = null,
            ProductName = $"{model.Name} ({lengthCm} cm · H {clearHeightCm} cm)",
            MonthlyRate = model.MonthlyRentalPrice!.Value,
            ShelterModelSlug = model.Slug,
            ConfiguredLengthCm = lengthCm,
            ConfiguredClearHeightCm = clearHeightCm,
            StartDate = startDate,
            EndDate = endDate,
            // Statut INITIAL : en attente du paiement (virement Interac, EPIC 7.2). Le contrat
            // n'est ACTIF qu'après réconciliation administrative du paiement (Activate). Mirroir de
            // Order.Create → OrderStatus.Pending.
            Status = RentalStatus.PendingPayment,
            Address = address,
        };
    }

    /// <summary>
    /// Attache une référence de paiement (virement Interac) au contrat, en posant un
    /// <see cref="PaymentInfo"/> EN ATTENTE. Garde : seulement tant que le contrat est en attente de
    /// paiement (<see cref="RentalStatus.PendingPayment"/>) — on n'altère pas le paiement d'un contrat
    /// déjà activé. Calque <c>Order.AttachPaymentReference</c>.
    /// </summary>
    public void AttachPaymentReference(string reference)
    {
        if (Status != RentalStatus.PendingPayment)
            throw new BusinessRuleException(
                "Une référence de paiement ne peut être attachée qu'à un contrat en attente de paiement.");
        Payment = PaymentInfo.Pending(reference);
    }

    /// <summary>
    /// Active le contrat après RÉCONCILIATION du paiement : confirme le paiement
    /// (<see cref="PaymentInfo.Confirm"/>) PUIS passe le statut à <see cref="RentalStatus.Active"/>.
    /// Gardes (L-046, défense en profondeur — calque <c>Order.MarkPaid</c>) :
    ///  - aucune référence de paiement attachée → lève ;
    ///  - paiement déjà confirmé → lève (un 2ᵉ appel donne un 422, idempotence) ;
    ///  - statut non-<see cref="RentalStatus.PendingPayment"/> → lève.
    /// Le paiement est confirmé AVANT le statut : si une garde lève, l'horodatage de paiement n'aura
    /// pas été posé sur un contrat non activable.
    /// </summary>
    public void Activate(DateTime nowUtc)
    {
        if (Payment is null)
            throw new BusinessRuleException(
                "Aucune référence de paiement n'est attachée à ce contrat.");

        // Invariant porté par le paiement lui-même (et pas seulement par le statut du contrat) :
        // un paiement déjà confirmé ne se re-confirme pas — défense en profondeur (L-046).
        if (Payment.ConfirmedAt is not null)
            throw new BusinessRuleException("Le paiement de ce contrat est déjà confirmé.");

        if (Status != RentalStatus.PendingPayment)
            throw new BusinessRuleException("Seul un contrat en attente de paiement peut être activé.");

        var confirmedPayment = Payment.Confirm(nowUtc);
        Status = RentalStatus.Active;
        Payment = confirmedPayment;
    }

    public void Cancel()
    {
        if (Status == RentalStatus.Expired)
            throw new BusinessRuleException("Impossible d'annuler un contrat expiré.");
        if (Status == RentalStatus.Cancelled)
            throw new BusinessRuleException("Ce contrat de location est déjà annulé.");
        // Annulable aussi depuis PendingPayment (paiement jamais reçu → on libère le contrat).
        Status = RentalStatus.Cancelled;
    }
}
