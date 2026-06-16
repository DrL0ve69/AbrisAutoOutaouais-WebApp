using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Produit du catalogue (abri simple, double, toile de remplacement, accessoire).
/// Règles métier : prix positif, stock >= 0, slug unique (validé dans le handler).
/// </summary>
public sealed class Product : ISoftDeletable, IAuditableEntity
{
    private readonly List<ProductImage> _images = [];

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public decimal Price { get; private set; }
    public decimal? RentalPrice { get; private set; }  // null = non louable
    public int Stock { get; private set; }
    public bool IsAvailable { get; private set; }
    public Guid CategoryId { get; private set; }

    // Dimensions hors-tout en centimètres — nullables (toiles, accessoires, petits
    // formats n'en ont pas). Plage métier 50–2000 cm validée dans les validators.
    public int? WidthCm { get; private set; }   // largeur
    public int? LengthCm { get; private set; }  // longueur (profondeur)
    public int? HeightCm { get; private set; }  // hauteur

    /// <summary>Marque du produit (optionnel ; null pour une toile ou un accessoire).</summary>
    public string? Brand { get; private set; }

    /// <summary>Modèle du produit (optionnel).</summary>
    public string? Model { get; private set; }

    public ProductCategory Category { get; private set; } = null!;
    public IReadOnlyList<ProductImage> Images => _images.AsReadOnly();

    // ISoftDeletable
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    // IAuditableEntity
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private Product() { }

    public static Product Create(
        string name, string slug, decimal price, int stock,
        Guid categoryId, string? description = null, decimal? rentalPrice = null,
        int? widthCm = null, int? lengthCm = null, int? heightCm = null,
        string? brand = null, string? model = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        if (price <= 0) throw new ArgumentException("Prix doit être positif.");
        if (stock < 0) throw new ArgumentException("Stock ne peut pas être négatif.");

        return new Product
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Slug = slug.Trim().ToLowerInvariant(),
            Price = price,
            RentalPrice = rentalPrice,
            Stock = stock,
            IsAvailable = stock > 0,
            CategoryId = categoryId,
            Description = description?.Trim(),
            WidthCm = widthCm,
            LengthCm = lengthCm,
            HeightCm = heightCm,
            Brand = string.IsNullOrWhiteSpace(brand) ? null : brand.Trim(),
            Model = string.IsNullOrWhiteSpace(model) ? null : model.Trim(),
        };
    }

    public void UpdateDetails(string name, string? description, decimal price)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (price <= 0) throw new ArgumentException("Prix doit être positif.");
        Name = name.Trim(); Description = description?.Trim(); Price = price;
    }

    /// <summary>Renseigne (ou efface, si null) les dimensions hors-tout en centimètres.</summary>
    public void SetDimensions(int? widthCm, int? lengthCm, int? heightCm)
    {
        WidthCm = widthCm;
        LengthCm = lengthCm;
        HeightCm = heightCm;
    }

    /// <summary>Renseigne (ou efface, si null/vide) la marque et le modèle du produit.</summary>
    public void SetBrandModel(string? brand, string? model)
    {
        Brand = string.IsNullOrWhiteSpace(brand) ? null : brand.Trim();
        Model = string.IsNullOrWhiteSpace(model) ? null : model.Trim();
    }

    public void AdjustStock(int delta)
    {
        var next = Stock + delta;
        if (next < 0) throw new BusinessRuleException("Stock ne peut pas être négatif.");
        Stock = next; IsAvailable = next > 0;
    }

    /// <summary>Déplace le produit dans une autre catégorie (validée dans le handler).</summary>
    public void ChangeCategory(Guid categoryId)
    {
        if (categoryId == Guid.Empty)
            throw new ArgumentException("La catégorie est requise.");
        CategoryId = categoryId;
    }

    public void AddImage(string url, string? altText = null)
        => _images.Add(ProductImage.Create(Id, url, altText));
}