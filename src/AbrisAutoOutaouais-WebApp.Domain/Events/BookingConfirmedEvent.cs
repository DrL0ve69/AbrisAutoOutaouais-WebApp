using Domain.ValueObjects;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Events;

public sealed record BookingConfirmedEvent(
    Guid BookingId,
    Guid CustomerId,
    DateTime SlotStart,
    Address Address) : IDomainEvent;
