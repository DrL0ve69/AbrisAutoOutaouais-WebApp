namespace Domain.Entities;

/// <summary>
/// Produit du catalogue (abri, toile, accessoire).
/// Seule méthode factory Create() crée un état valide — impossible de construire un Product invalide.
/// </summary>
public sealed class Product : ISoftDeletable, IAuditableEntity
{
    private readonly List<ProductImage> _images = [];

    public Guid     Id          { get; private set; }
    public string   Name        { get; private set; } = string.Empty;
    public string   Slug        { get; private set; } = string.Empty;  // URL-friendly
    public string?  Description { get; private set; }
    public decimal  Price       { get; private set; }
    public decimal? RentalPrice { get; private set; }  // null si non louable
    public int      Stock       { get; private set; }
    public bool     IsAvailable { get; private set; }
    public Guid     CategoryId  { get; private set; }

    // Navigation (pas de FK cross-context — juste un Guid)
    public ProductCategory Category { get; private set; } = null!;

    public IReadOnlyList<ProductImage> Images => _images.AsReadOnly();

    // ISoftDeletable
    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    // IAuditableEntity
    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

    private Product() { }  // EF Core

    /// <summary>Seul point de création valide d'un produit.</summary>
    public static Product Create(
        string   name,
        string   slug,
        decimal  price,
        int      stock,
        Guid     categoryId,
        string?  description  = null,
        decimal? rentalPrice  = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        if (price <= 0)  throw new ArgumentException("Le prix doit être positif.", nameof(price));
        if (stock < 0)   throw new ArgumentException("Le stock ne peut pas être négatif.", nameof(stock));

        return new Product
        {
            Id          = Guid.NewGuid(),
            Name        = name.Trim(),
            Slug        = slug.Trim().ToLowerInvariant(),
            Price       = price,
            RentalPrice = rentalPrice,
            Stock       = stock,
            IsAvailable = stock > 0,
            CategoryId  = categoryId,
            Description = description?.Trim(),
        };
    }

    public void UpdateDetails(string name, string? description, decimal price)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (price <= 0) throw new ArgumentException("Le prix doit être positif.", nameof(price));

        Name        = name.Trim();
        Description = description?.Trim();
        Price       = price;
    }

    public void AdjustStock(int delta)
    {
        var newStock = Stock + delta;
        if (newStock < 0)
            throw new BusinessRuleException("Le stock ne peut pas être négatif.");

        Stock       = newStock;
        IsAvailable = newStock > 0;
    }
}