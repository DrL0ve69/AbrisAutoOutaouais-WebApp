using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using Domain.ValueObjects;

namespace Domain.Entities;

/// <summary>
/// Créneau d'installation, livraison ou démontage.
/// CustomerId = Guid référençant AppUser.Id.
/// </summary>
public sealed class BookingSlot : ISoftDeletable, IAuditableEntity
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid? OrderId { get; private set; }
    public DateTime SlotStart { get; private set; }
    public int DurationMin { get; private set; }
    public BookingType Type { get; private set; }
    public BookingStatus Status { get; private set; }
    public Address Address { get; private set; } = null!;
    public string? Notes { get; private set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private BookingSlot() { }

    public static BookingSlot Create(
        Guid customerId, DateTime slotStart, int durationMin,
        BookingType type, Address address,
        Guid? orderId = null, string? notes = null)
    {
        if (slotStart <= DateTime.UtcNow)
            throw new BusinessRuleException("Le créneau doit être dans le futur.");
        if (durationMin <= 0)
            throw new ArgumentException("Durée doit être positive.");

        return new BookingSlot
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            OrderId = orderId,
            SlotStart = slotStart,
            DurationMin = durationMin,
            Type = type,
            Status = BookingStatus.Pending,
            Address = address,
            Notes = notes?.Trim(),
        };
    }

    public void Confirm()
    {
        if (Status != BookingStatus.Pending)
            throw new BusinessRuleException("Seul un créneau en attente peut être confirmé.");
        Status = BookingStatus.Confirmed;
    }

    public void Cancel()
    {
        if (Status == BookingStatus.Completed)
            throw new BusinessRuleException("Un créneau complété ne peut pas être annulé.");
        Status = BookingStatus.Cancelled;
    }
}