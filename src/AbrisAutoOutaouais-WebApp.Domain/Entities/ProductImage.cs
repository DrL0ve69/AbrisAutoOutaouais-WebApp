using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

public sealed class ProductImage
{
    public Guid Id { get; private set; }
    public Guid ProductId { get; private set; }
    public string Url { get; private set; } = string.Empty;
    public string? AltText { get; private set; }
    public int SortOrder { get; private set; }

    private ProductImage() { }

    internal static ProductImage Create(Guid productId, string url, string? altText = null)
        => new() { Id = Guid.NewGuid(), ProductId = productId, Url = url, AltText = altText };
}
