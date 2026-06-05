using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Events;

public sealed record OrderPlacedEvent(
    Guid OrderId,
    Guid CustomerId,
    decimal TotalAmount) : IDomainEvent;
