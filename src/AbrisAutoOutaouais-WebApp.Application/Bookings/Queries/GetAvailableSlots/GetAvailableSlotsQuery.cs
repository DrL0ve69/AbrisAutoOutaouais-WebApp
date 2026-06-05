using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Bookings.Queries.GetAvailableSlots;

public sealed record GetAvailableSlotsQuery(
    DateOnly From,
    DateOnly To) : IQuery<IReadOnlyList<AvailableSlotDto>>;

public sealed record AvailableSlotDto(DateTime Start, DateTime End);
