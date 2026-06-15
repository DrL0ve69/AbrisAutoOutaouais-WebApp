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
/// <paramref name="GuestContact"/> est non nul UNIQUEMENT pour un visiteur non connecté : il déclenche
/// la création/réutilisation d'un compte express (cf. <c>IExpressAccountService</c>). Null = utilisateur
/// connecté. Dernier paramètre (défaut null) pour ne pas casser les appels existants.
/// </summary>
public sealed record PlaceOrderCommand(
    IReadOnlyList<OrderLineRequest> Lines,
    DeliveryType DeliveryType,
    AddressDto? ShippingAddress,
    GuestContact? GuestContact = null) : ICommand<Guid>;
