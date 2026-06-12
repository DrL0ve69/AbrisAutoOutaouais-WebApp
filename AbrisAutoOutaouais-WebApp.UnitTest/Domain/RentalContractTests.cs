using Domain.ValueObjects;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Règles métier du contrat de location, en particulier les transitions d'annulation :
/// on annule un contrat « Active », jamais un contrat déjà « Cancelled » ou « Expired ».
/// </summary>
public sealed class RentalContractTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Product MakeRentableProduct(decimal rentalPrice = 49m)
        => Product.Create("Abri simple", "abri-simple", 599m, 10, Guid.NewGuid(),
            "Abri saisonnier.", rentalPrice);

    private static Address MakeAddress()
        => Address.Create("123 rue des Érables", "Gatineau", "QC", "J8X1A1");

    private static RentalContract MakeActiveContract()
        => RentalContract.Create(
            Guid.NewGuid(), MakeRentableProduct(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), MakeAddress());

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_RentableProduct_StartsActive()
    {
        var contract = MakeActiveContract();

        contract.Status.Should().Be(RentalStatus.Active);
    }

    [Fact]
    public void Create_NonRentableProduct_Throws()
    {
        var nonRentable = Product.Create("Abri", "abri", 599m, 10, Guid.NewGuid()); // rentalPrice null

        var act = () => RentalContract.Create(
            Guid.NewGuid(), nonRentable,
            new DateOnly(2026, 7, 1), new DateOnly(2026, 10, 1), MakeAddress());

        act.Should().Throw<BusinessRuleException>().WithMessage("*location*");
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
