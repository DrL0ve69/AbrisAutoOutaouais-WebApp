using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using Domain.Entities;
using Domain.ValueObjects;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Contrat de location d'un abri temporaire.
/// CustomerId = Guid référençant AppUser.Id.
/// </summary>
public sealed class RentalContract : ISoftDeletable, IAuditableEntity
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid ProductId { get; private set; }
    public string ProductName { get; private set; } = string.Empty; // snapshot
    public decimal MonthlyRate { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public RentalStatus Status { get; private set; }
    public Address Address { get; private set; } = null!;  // adresse d'installation

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private RentalContract() { }

    public static RentalContract Create(
        Guid customerId, Product product,
        DateOnly startDate, DateOnly endDate, Address address)
    {
        if (product.RentalPrice is null)
            throw new BusinessRuleException($"« {product.Name} » n'est pas disponible à la location.");
        if (endDate <= startDate)
            throw new BusinessRuleException("La date de fin doit être après la date de début.");

        return new RentalContract
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            ProductId = product.Id,
            ProductName = product.Name,
            MonthlyRate = product.RentalPrice.Value,
            StartDate = startDate,
            EndDate = endDate,
            Status = RentalStatus.Active,
            Address = address,
        };
    }

    public void Cancel()
    {
        if (Status == RentalStatus.Expired)
            throw new BusinessRuleException("Impossible d'annuler un contrat expiré.");
        Status = RentalStatus.Cancelled;
    }
}
