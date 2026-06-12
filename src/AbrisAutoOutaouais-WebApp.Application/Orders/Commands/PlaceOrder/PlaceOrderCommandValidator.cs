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
            // Accepte le format canadien avec OU sans espace, en majuscules ou minuscules
            // (« J7T 1A1 » / « j7t1a1 ») — cohérent avec le formulaire de profil, l'adresse
            // par défaut pré-remplie et Address.Create (qui met en majuscules). Auparavant
            // « ^[A-Z]\d[A-Z]\d[A-Z]\d$ » rejetait l'espace → 400 sur une adresse pourtant valide.
            RuleFor(x => x.ShippingAddress!.PostalCode)
                .Matches(@"^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$")
                .WithMessage("Format de code postal invalide (ex: J7T 1A1).");
        });
    }
}
