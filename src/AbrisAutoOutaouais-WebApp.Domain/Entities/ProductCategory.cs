using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

public class ProductCategory
{
    public Guid Id { get; set; }
    public Enums.ProductCategory Category { get; set; }
    public string? Name { get; set; } = "Non-disponible";
}
