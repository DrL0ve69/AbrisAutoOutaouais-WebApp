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

    [Theory]
    [InlineData("J8X 1A1")] // format canonique avec espace (profil + autofill)
    [InlineData("J8X1A1")]  // sans espace
    [InlineData("j8x 1a1")] // minuscules (Address.Create les met en majuscules)
    public void Validate_DeliveryWithValidPostal_HasNoPostalError(string postalCode)
    {
        _validator.TestValidate(DeliveryWithPostal(postalCode))
            .ShouldNotHaveValidationErrorFor(x => x.ShippingAddress!.PostalCode);
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
