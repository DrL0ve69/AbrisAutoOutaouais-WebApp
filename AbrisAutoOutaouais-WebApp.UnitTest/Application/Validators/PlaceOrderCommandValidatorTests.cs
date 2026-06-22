using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;
using AbrisAutoOutaouais_WebApp.Domain.Common;
using FluentValidation.TestHelper;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Validators;

/// <summary>
/// Garde-fou de contrat : le code postal accepté par la caisse doit correspondre au format
/// que le profil enregistre et que l'autofill pré-remplit (« A1A 1A1 », avec espace). Une regex
/// trop stricte (sans espace) provoquait un 400 sur une adresse de livraison pourtant valide.
/// </summary>
public sealed class PlaceOrderCommandValidatorTests
{
    private readonly PlaceOrderCommandValidator _validator = new();

    private static PlaceOrderCommand DeliveryWithPostal(string postalCode) => new(
        Lines: [new OrderLineRequest(Guid.NewGuid(), 1)],
        DeliveryType: DeliveryType.Delivery,
        ShippingAddress: new AddressDto("123", "rue des Abris", null, "Gatineau", "QC", postalCode, "Canada"));

    private static PlaceOrderCommand DeliveryWithProvince(string province, string postalCode) => new(
        Lines: [new OrderLineRequest(Guid.NewGuid(), 1)],
        DeliveryType: DeliveryType.Delivery,
        ShippingAddress: new AddressDto("111", "rue Wellington", null, "Ottawa", province, postalCode, "Canada"));

    [Theory]
    [InlineData("J8X 1A1")] // format canonique avec espace (profil + autofill)
    [InlineData("J8X1A1")]  // sans espace
    [InlineData("j8x 1a1")] // minuscules (Address.Create les met en majuscules)
    [InlineData("K1A 0A6")] // code postal hors-Québec (Ontario) avec espace
    public void Validate_DeliveryWithValidPostal_HasNoPostalError(string postalCode)
    {
        _validator.TestValidate(DeliveryWithPostal(postalCode))
            .ShouldNotHaveValidationErrorFor(x => x.ShippingAddress!.PostalCode);
    }

    /// <summary>
    /// Garde-fou L-004 / L-002 : une adresse de livraison hors Québec (province ≠ « QC »,
    /// ici l'Ontario pré-rempli depuis le profil) doit passer sans AUCUNE erreur de validation.
    /// Il n'existe volontairement pas de liste blanche de provinces — en ajouter une recréerait
    /// le 400 « adresse Ontario refusée » que ce test verrouille contre toute régression.
    /// </summary>
    [Theory]
    [InlineData("ON", "K1A 0A6")] // Ontario, code postal avec espace (scénario rapporté)
    [InlineData("ON", "K1A0A6")]  // Ontario, sans espace
    [InlineData("BC", "V6B 1A1")] // autre province, pour prouver l'absence de liste blanche
    public void Validate_DeliveryWithNonQuebecProvince_HasNoValidationErrors(
        string province, string postalCode)
    {
        _validator.TestValidate(DeliveryWithProvince(province, postalCode))
            .ShouldNotHaveAnyValidationErrors();
    }

    /// <summary>
    /// Garde-fou D5 (zone de service NON bloquante). Une adresse de livraison VALIDE mais
    /// géographiquement HORS de la zone de service (~100 km de la base — ici Montréal, confirmé
    /// hors zone par <see cref="GeoDistance.IsWithinServiceArea"/>) doit passer la validation SANS
    /// erreur : l'avertissement « hors zone » est purement informatif côté client (signal +
    /// aria-live). Y ajouter un <c>RuleFor(distance)</c> rééditerait la régression « → 422 » (L-004).
    /// </summary>
    [Fact]
    public void Validate_DeliveryToAddressOutsideServiceArea_HasNoValidationErrors()
    {
        // Montréal — adresse réelle et valide, mais hors zone (preuve via l'util Domain miroir).
        GeoDistance.IsWithinServiceArea(45.5019, -73.5674).Should().BeFalse();

        var cmd = new PlaceOrderCommand(
            Lines: [new OrderLineRequest(Guid.NewGuid(), 1)],
            DeliveryType: DeliveryType.Delivery,
            ShippingAddress: new AddressDto(
                "1000", "rue Sainte-Catherine", null, "Montréal", "QC", "H3B 4W5", "Canada"));

        _validator.TestValidate(cmd).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("J8X 1A")]
    [InlineData("")]
    public void Validate_DeliveryWithInvalidPostal_HasPostalError(string postalCode)
    {
        _validator.TestValidate(DeliveryWithPostal(postalCode))
            .ShouldHaveValidationErrorFor(x => x.ShippingAddress!.PostalCode);
    }

    [Fact]
    public void Validate_Pickup_DoesNotRequireAddress()
    {
        var cmd = new PlaceOrderCommand(
            [new OrderLineRequest(Guid.NewGuid(), 1)], DeliveryType.Pickup, null);

        _validator.TestValidate(cmd).ShouldNotHaveAnyValidationErrors();
    }

    // ── Lignes d'abri configuré (EPIC 9.4) ──────────────────────────────────────

    private static PlaceOrderCommand ShelterPickup(string slug, int lengthCm, int qty, int clearHeightCm = 198) => new(
        Lines: [],
        DeliveryType: DeliveryType.Pickup,
        ShippingAddress: null,
        ShelterLines: [new ShelterLineRequest(slug, lengthCm, clearHeightCm, qty)]);

    [Fact]
    public void Validate_ShelterOnlyOrder_HasNoValidationErrors()
    {
        // Une commande d'abri seul (Lines vide) est légitime — aucune erreur attendue.
        _validator.TestValidate(ShelterPickup("abri-simple", 488, 1))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_BothListsEmpty_HasError()
    {
        var cmd = new PlaceOrderCommand([], DeliveryType.Pickup, null, ShelterLines: []);

        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.Lines);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_ShelterLineWithEmptySlug_HasError(string slug)
    {
        _validator.TestValidate(ShelterPickup(slug, 488, 1))
            .ShouldHaveValidationErrorFor("ShelterLines[0].Slug");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_ShelterLineWithNonPositiveQuantity_HasError(int qty)
    {
        _validator.TestValidate(ShelterPickup("abri-simple", 488, qty))
            .ShouldHaveValidationErrorFor("ShelterLines[0].Quantity");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-122)]
    public void Validate_ShelterLineWithNonPositiveLength_HasError(int lengthCm)
    {
        _validator.TestValidate(ShelterPickup("abri-simple", lengthCm, 1))
            .ShouldHaveValidationErrorFor("ShelterLines[0].LengthCm");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-198)]
    public void Validate_ShelterLineWithNonPositiveClearHeight_HasError(int clearHeightCm)
    {
        _validator.TestValidate(ShelterPickup("abri-simple", 488, 1, clearHeightCm))
            .ShouldHaveValidationErrorFor("ShelterLines[0].ClearHeightCm");
    }
}
