using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Domain.ValueObjects;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Règles métier du contrat de location, post-rework « location sur modèle paramétrique » :
/// un contrat se crée pour un <see cref="ShelterModel"/> LOUABLE (tarif mensuel non nul) et une
/// TAILLE (longueur × hauteur dégagée) admissible au regard de la grille du modèle. On couvre la
/// création (modèle louable + taille valide), les rejets (modèle non louable, taille hors grille,
/// dates incohérentes) et les transitions d'annulation.
/// </summary>
public sealed class RentalContractTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Modèle LOUABLE : grille dense sur [122, 366] par pas de 122, hauteurs {198}, tarif mensuel 49 $.
    /// Une taille valide est donc (122, 198), (244, 198) ou (366, 198).
    /// </summary>
    private static ShelterModel MakeRentableModel(int? monthlyRentalCents = 4900)
        => ShelterModelTestData.CreateWithGrid(
            "abri-loc", "Abri simple — Abris Tempo", Guid.NewGuid(),
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 366,
            basePrice: 349.00m, pricePerArchCents: 15000,
            widthsCm: [335], clearHeightsCm: [198],
            monthlyRentalCents: monthlyRentalCents);

    private static Address MakeAddress()
        => Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1");

    private static RentalContract MakePendingContract()
        => RentalContract.CreateForModel(
            Guid.NewGuid(), MakeRentableModel(), 122, 198,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), MakeAddress());

    /// <summary>Contrat ACTIVÉ : créé (PendingPayment) → réf attachée → Activate.</summary>
    private static RentalContract MakeActiveContract()
    {
        var contract = MakePendingContract();
        contract.AttachPaymentReference("REF-LOC-001");
        contract.Activate(new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc));
        return contract;
    }

    // ── CreateForModel ──────────────────────────────────────────────────────────

    [Fact]
    public void CreateForModel_RentableModel_StartsPendingPayment_AndSnapshotsRateAndSize()
    {
        var contract = MakePendingContract();

        // EPIC 7.2 : le contrat naît EN ATTENTE DE PAIEMENT (virement Interac), pas Active.
        contract.Status.Should().Be(RentalStatus.PendingPayment);
        contract.Payment.Should().BeNull();                 // aucune réf tant qu'on ne l'attache pas
        contract.MonthlyRate.Should().Be(49.00m);           // 4900 ¢ → 49 $
        contract.ShelterModelSlug.Should().Be("abri-loc");
        contract.ConfiguredLengthCm.Should().Be(122);
        contract.ConfiguredClearHeightCm.Should().Be(198);
        contract.ProductId.Should().BeNull();               // plus de produit sous-jacent
        contract.ProductName.Should().Contain("122 cm").And.Contain("198 cm");
    }

    // ── TotalAmount (montant total dû d'avance) — EPIC 7.2 ──────────────────────

    /// <summary>
    /// Crée un contrat sur le modèle louable par défaut (tarif 49 $/mois sauf override) entre deux
    /// dates, pour exercer le calcul du montant total.
    /// </summary>
    private static RentalContract MakeContract(DateOnly start, DateOnly end, int? monthlyRentalCents = 4900)
        => RentalContract.CreateForModel(
            Guid.NewGuid(), MakeRentableModel(monthlyRentalCents), 122, 198, start, end, MakeAddress());

    [Fact]
    public void TotalAmount_WholeMonths_MultipliesRateByMonthCount()
    {
        // 2026-07-01 → 2026-10-01 = 3 mois pleins ; tarif 100 $/mois → 300 $.
        var contract = MakeContract(new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), monthlyRentalCents: 10000);

        contract.TotalAmount.Should().Be(300.00m);
    }

    [Fact]
    public void TotalAmount_PartialMonth_RoundsUpToFullMonth()
    {
        // 2026-07-01 → 2026-09-15 : 2 mois pleins + un mois entamé → 3 mois ; 100 $/mois → 300 $.
        var contract = MakeContract(new DateOnly(2026, 7, 1), new DateOnly(2026, 9, 15), monthlyRentalCents: 10000);

        contract.TotalAmount.Should().Be(300.00m);
    }

    [Fact]
    public void TotalAmount_LessThanOneMonth_FloorsAtOneMonth()
    {
        // 2026-07-01 → 2026-07-15 : moins d'un mois → minimum 1 mois ; 100 $/mois → 100 $.
        var contract = MakeContract(new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 15), monthlyRentalCents: 10000);

        contract.TotalAmount.Should().Be(100.00m);
    }

    [Fact]
    public void TotalAmount_DefaultRate_MatchesRateTimesMonths()
    {
        // Tarif par défaut 49 $/mois ; 2026-07-01 → 2026-10-01 = 3 mois → 147 $.
        var contract = MakeContract(new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1));

        contract.TotalAmount.Should().Be(147.00m);
    }

    // ── Paiement (virement Interac) — EPIC 7.2 ──────────────────────────────────

    [Fact]
    public void AttachPaymentReference_OnPending_SetsPendingPaymentInfo()
    {
        var contract = MakePendingContract();

        contract.AttachPaymentReference("REF-LOC-001");

        contract.Payment.Should().NotBeNull();
        contract.Payment!.Reference.Should().Be("REF-LOC-001");
        contract.Payment.ConfirmedAt.Should().BeNull();
        contract.Status.Should().Be(RentalStatus.PendingPayment);   // toujours en attente
    }

    [Fact]
    public void Activate_ConfirmsPaymentAndActivates()
    {
        var contract = MakePendingContract();
        contract.AttachPaymentReference("REF-LOC-001");
        var now = new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc);

        contract.Activate(now);

        contract.Status.Should().Be(RentalStatus.Active);
        contract.Payment!.ConfirmedAt.Should().Be(now);
        contract.Payment.Reference.Should().Be("REF-LOC-001");      // référence conservée
    }

    [Fact]
    public void Activate_WhenNoPaymentAttached_Throws()
    {
        var contract = MakePendingContract();   // aucune référence attachée

        var act = () => contract.Activate(DateTime.UtcNow);

        act.Should().Throw<BusinessRuleException>().WithMessage("*référence de paiement*");
    }

    [Fact]
    public void Activate_WhenAlreadyConfirmed_Throws()
    {
        var contract = MakePendingContract();
        contract.AttachPaymentReference("REF-LOC-001");
        contract.Activate(new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc));

        // 2ᵉ appel sur un paiement déjà confirmé → 422 (idempotence, L-046).
        var act = () => contract.Activate(DateTime.UtcNow);

        act.Should().Throw<BusinessRuleException>().WithMessage("*déjà confirmé*");
    }

    [Fact]
    public void AttachPaymentReference_WhenNotPending_Throws()
    {
        var contract = MakeActiveContract();   // déjà Active

        var act = () => contract.AttachPaymentReference("REF-LOC-002");

        act.Should().Throw<BusinessRuleException>().WithMessage("*en attente de paiement*");
    }

    [Fact]
    public void Cancel_FromPendingPayment_SetsStatusCancelled()
    {
        var contract = MakePendingContract();   // jamais payé

        contract.Cancel();

        contract.Status.Should().Be(RentalStatus.Cancelled);
    }

    [Fact]
    public void CreateForModel_NonRentableModel_Throws()
    {
        var nonRentable = MakeRentableModel(monthlyRentalCents: null); // tarif null → non louable

        var act = () => RentalContract.CreateForModel(
            Guid.NewGuid(), nonRentable, 122, 198,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), MakeAddress());

        act.Should().Throw<BusinessRuleException>().WithMessage("*location*");
    }

    [Fact]
    public void CreateForModel_OffGridLength_Throws()
    {
        // 200 cm n'est pas aligné sur le pas de 122 depuis 122 (122, 244, 366 seulement).
        var act = () => RentalContract.CreateForModel(
            Guid.NewGuid(), MakeRentableModel(), 200, 198,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), MakeAddress());

        act.Should().Throw<BusinessRuleException>().WithMessage("*longueur*");
    }

    [Fact]
    public void CreateForModel_UnofferedHeight_Throws()
    {
        // Hauteur 259 hors des options offertes {198}.
        var act = () => RentalContract.CreateForModel(
            Guid.NewGuid(), MakeRentableModel(), 122, 259,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), MakeAddress());

        act.Should().Throw<BusinessRuleException>().WithMessage("*hauteur*");
    }

    [Fact]
    public void CreateForModel_EndBeforeStart_Throws()
    {
        var act = () => RentalContract.CreateForModel(
            Guid.NewGuid(), MakeRentableModel(), 122, 198,
            new DateOnly(2026, 10, 1), new DateOnly(2026, 7, 1), MakeAddress());

        act.Should().Throw<BusinessRuleException>().WithMessage("*date de fin*");
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    [Fact]
    public void Cancel_FromActive_SetsStatusCancelled()
    {
        var contract = MakeActiveContract();

        contract.Cancel();

        contract.Status.Should().Be(RentalStatus.Cancelled);
    }

    [Fact]
    public void Cancel_WhenAlreadyCancelled_Throws()
    {
        var contract = MakeActiveContract();
        contract.Cancel();

        var act = () => contract.Cancel();

        act.Should().Throw<BusinessRuleException>().WithMessage("*déjà annulé*");
    }
}
