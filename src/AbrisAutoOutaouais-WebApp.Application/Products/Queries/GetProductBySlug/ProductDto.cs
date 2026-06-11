using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;

public sealed record ProductDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    decimal Price,
    decimal? RentalPrice,
    int Stock,
    bool IsAvailable,
    string CategoryName,
    IReadOnlyList<string> ImageUrls);

