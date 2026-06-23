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

    private static RentalContract MakeActiveContract()
        => RentalContract.CreateForModel(
            Guid.NewGuid(), MakeRentableModel(), 122, 198,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), MakeAddress());

    // ── CreateForModel ──────────────────────────────────────────────────────────

    [Fact]
    public void CreateForModel_RentableModel_StartsActive_AndSnapshotsRateAndSize()
    {
        var contract = MakeActiveContract();

        contract.Status.Should().Be(RentalStatus.Active);
        contract.MonthlyRate.Should().Be(49.00m);           // 4900 ¢ → 49 $
        contract.ShelterModelSlug.Should().Be("abri-loc");
        contract.ConfiguredLengthCm.Should().Be(122);
        contract.ConfiguredClearHeightCm.Should().Be(198);
        contract.ProductId.Should().BeNull();               // plus de produit sous-jacent
        contract.ProductName.Should().Contain("122 cm").And.Contain("198 cm");
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
