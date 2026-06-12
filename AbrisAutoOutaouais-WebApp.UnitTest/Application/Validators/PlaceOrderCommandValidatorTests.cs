using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;
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
        ShippingAddress: new AddressDto("123 rue des Abris", "Gatineau", "QC", postalCode, "Canada"));

    private static PlaceOrderCommand DeliveryWithProvince(string province, string postalCode) => new(
        Lines: [new OrderLineRequest(Guid.NewGuid(), 1)],
        DeliveryType: DeliveryType.Delivery,
        ShippingAddress: new AddressDto("111 rue Wellington", "Ottawa", province, postalCode, "Canada"));

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
}
