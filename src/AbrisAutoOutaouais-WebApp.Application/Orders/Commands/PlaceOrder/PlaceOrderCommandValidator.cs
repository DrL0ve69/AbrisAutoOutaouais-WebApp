using AbrisAutoOutaouais_WebApp.Application.Common.Validators;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;

public sealed class PlaceOrderCommandValidator : AbstractValidator<PlaceOrderCommand>
{
    public PlaceOrderCommandValidator()
    {
        RuleFor(x => x.Lines).NotEmpty().WithMessage("La commande doit contenir au moins un produit.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.ProductId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("Quantité doit être positive.");
        });

        // En livraison, l'adresse est requise ET validée par la source canonique unique
        // (AddressDtoValidator) — même format de code postal/numéro civique que le profil et
        // l'autofill (leçon L-004 : un seul validateur partagé pour un format partagé).
        When(x => x.DeliveryType == DeliveryType.Delivery, () =>
        {
            RuleFor(x => x.ShippingAddress).NotNull()
                .WithMessage("Adresse requise pour la livraison.");
            RuleFor(x => x.ShippingAddress!).SetValidator(new AddressDtoValidator());
        });
    }
}
