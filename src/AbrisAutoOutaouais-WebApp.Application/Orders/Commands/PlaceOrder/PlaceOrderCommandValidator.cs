using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Text;

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

        When(x => x.DeliveryType == DeliveryType.Delivery, () =>
        {
            RuleFor(x => x.ShippingAddress).NotNull()
                .WithMessage("Adresse requise pour la livraison.");
            RuleFor(x => x.ShippingAddress!.Street).NotEmpty();
            RuleFor(x => x.ShippingAddress!.City).NotEmpty();
            RuleFor(x => x.ShippingAddress!.PostalCode)
                .Matches(@"^[A-Z]\d[A-Z]\d[A-Z]\d$")
                .WithMessage("Format de code postal invalide (ex: J7T1A1).");
        });
    }
}
