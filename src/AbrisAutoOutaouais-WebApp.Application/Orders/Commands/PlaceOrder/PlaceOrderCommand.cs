using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;

public sealed record OrderLineRequest(Guid ProductId, int Quantity);

/// <summary>
/// Ligne d'ABRI CONFIGURÉ (paramétrique, EPIC 9.4) : le client envoie le slug du modèle, la longueur
/// ET la hauteur dégagée choisies, et la quantité — JAMAIS de prix. Le serveur recalcule le prix
/// autoritairement (<c>ShelterPriceCalculator</c>, source unique — L-004) et VALIDE que
/// <paramref name="ClearHeightCm"/> est bien une des hauteurs offertes par le modèle (sinon 422).
/// La largeur n'est PAS transmise : elle est implicite au slug (« une largeur = un modèle », EPIC 9).
/// </summary>
public sealed record ShelterLineRequest(string Slug, int LengthCm, int ClearHeightCm, int Quantity);

/// <summary>
/// <paramref name="GuestContact"/> est non nul UNIQUEMENT pour un visiteur non connecté : il déclenche
/// la création/réutilisation d'un compte express (cf. <c>IExpressAccountService</c>). Null = utilisateur
/// connecté. <paramref name="ShelterLines"/> (défaut null) porte les lignes d'abri configuré ; une
/// commande est valide dès qu'<see cref="Lines"/> OU <see cref="ShelterLines"/> contient au moins une
/// ligne. Les derniers paramètres (défaut null) ne cassent pas les appels existants.
/// </summary>
public sealed record PlaceOrderCommand(
    IReadOnlyList<OrderLineRequest> Lines,
    DeliveryType DeliveryType,
    AddressDto? ShippingAddress,
    GuestContact? GuestContact = null,
    IReadOnlyList<ShelterLineRequest>? ShelterLines = null) : ICommand<Guid>;
