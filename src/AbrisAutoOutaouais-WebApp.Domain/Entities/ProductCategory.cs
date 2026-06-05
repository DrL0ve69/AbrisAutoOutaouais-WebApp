using AbrisAutoOutaouais_WebApp.Domain.Interfaces;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

public sealed class ProductCategory : IAuditableEntity
{
    // Données de référence — peut être Enum ou entité selon la flexibilité souhaitée
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private ProductCategory() { }

    public static ProductCategory Create(string name, string slug) =>
        new() { Id = Guid.NewGuid(), Name = name, Slug = slug };
}
