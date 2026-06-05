using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.PlaceOrder;

public sealed record OrderLineRequest(Guid ProductId, int Quantity);

public sealed record PlaceOrderCommand(
    IReadOnlyList<OrderLineRequest> Lines,
    DeliveryType DeliveryType,
    AddressDto? ShippingAddress) : ICommand<Guid>;
