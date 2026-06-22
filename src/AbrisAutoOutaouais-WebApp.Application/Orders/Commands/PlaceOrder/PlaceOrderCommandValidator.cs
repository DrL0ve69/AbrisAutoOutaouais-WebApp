using AbrisAutoOutaouais_WebApp.Application.Common.Validators;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;

public sealed class PlaceOrderCommandValidator : AbstractValidator<PlaceOrderCommand>
{
    public PlaceOrderCommandValidator()
    {
        // Une commande doit porter au moins une ligne — produit OU abri configuré (EPIC 9.4).
        // Une commande d'abri seul est légitime, donc on ne peut plus exiger Lines non vide seul.
        RuleFor(x => x)
            .Must(x => (x.Lines is { Count: > 0 }) || (x.ShelterLines is { Count: > 0 }))
            .WithMessage("La commande doit contenir au moins un produit ou un abri.")
            .OverridePropertyName(nameof(PlaceOrderCommand.Lines));

        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.ProductId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("Quantité doit être positive.");
        });

        // Lignes d'abri configuré : slug requis, longueur et quantité strictement positives. Les
        // bornes/alignement de la longueur restent dans le handler (ils nécessitent le modèle chargé).
        RuleForEach(x => x.ShelterLines).ChildRules(line =>
        {
            line.RuleFor(l => l.Slug).NotEmpty().WithMessage("Le modèle d'abri est requis.");
            line.RuleFor(l => l.LengthCm).GreaterThan(0).WithMessage("La longueur doit être positive.");
            line.RuleFor(l => l.ClearHeightCm).GreaterThan(0).WithMessage("La hauteur dégagée est requise.");
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

        // Parcours invité : le contact n'est validé que s'il est fourni (utilisateur connecté → null),
        // par la source canonique unique GuestContactValidator (leçon L-004).
        When(x => x.GuestContact is not null, () =>
        {
            RuleFor(x => x.GuestContact!).SetValidator(new GuestContactValidator());
        });
    }
}
