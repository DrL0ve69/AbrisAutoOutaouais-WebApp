# LAYER_DOMAIN.md — Couche Domain

La couche la plus intérieure. **Zéro dépendance externe** — aucun NuGet, aucune référence
à EF Core, ASP.NET, ou Identity. Contient les règles métier pures.

---

## Règle d'or

Si tu dois ajouter un `using Microsoft.*` dans Domain, c'est un signal d'alarme.
Seuls les namespaces `System.*` sont acceptables.

---

## Arborescence complète

```
src/AbrisAutoOutaouais-WebApp.Domain/
├── AbrisAutoOutaouais-WebApp.Domain.csproj
│
├── Constants/
│   └── Roles.cs                    ← rôles métier (string constants)
│
├── Entities/
│   ├── Product.cs                  ← produit du catalogue
│   ├── ProductCategory.cs          ← catégorie de produit
│   ├── ProductImage.cs             ← image liée à un produit
│   ├── Order.cs                    ← agrégat commande
│   ├── OrderLine.cs                ← ligne de commande (enfant d'Order)
│   ├── RentalContract.cs           ← contrat de location
│   └── BookingSlot.cs              ← créneau d'installation/livraison
│
├── ValueObjects/
│   ├── Address.cs                  ← adresse (Order, BookingSlot, AppUser)
│   ├── Money.cs                    ← montant avec devise
│   └── PhoneNumber.cs              ← numéro de téléphone (ébauche)
│
├── Enums/
│   ├── OrderStatus.cs
│   ├── DeliveryType.cs
│   ├── RentalStatus.cs
│   ├── BookingStatus.cs
│   └── BookingType.cs
│
├── Events/
│   ├── IDomainEvent.cs             ← marqueur
│   ├── OrderPlacedEvent.cs
│   ├── BookingConfirmedEvent.cs
│   └── RentalCreatedEvent.cs
│
├── Exceptions/
│   └── DomainExceptions.cs         ← TOUTES les exceptions dans UN seul fichier
│                                     (NotFoundException, ConflictException,
│                                      ForbiddenException, BusinessRuleException)
│
└── Interfaces/
    ├── ISoftDeletable.cs
    └── IAuditableEntity.cs
```

> **Namespaces** : tous les types Domain vivent sous le préfixe complet
> `AbrisAutoOutaouais_WebApp.Domain.*` (underscore, pas de tiret). Ex :
> `AbrisAutoOutaouais_WebApp.Domain.Entities`, `…Domain.Exceptions`, etc.

> **`AppUser` n'est PAS ici.** Il vit dans `Infrastructure/Identity/` car il hérite
> de `IdentityUser<Guid>` (ASP.NET Core Identity = dépendance d'infrastructure).
> Il n'y a PAS d'entité `Customer` — AppUser est le client.

---

## Domain.csproj

```xml
<!-- src/AbrisAutoOutaouais-WebApp.Domain/AbrisAutoOutaouais-WebApp.Domain.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
  <!-- Aucun PackageReference — zéro dépendance externe -->
</Project>
```

---

## Constants/

### `Constants/Roles.cs`

Défini dans Domain (couche la plus intérieure) pour être accessible depuis
Application, Infrastructure ET Api sans violer les règles de dépendance.

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Constants;

public static class Roles
{
    public const string Customer   = nameof(Customer);
    public const string Staff      = nameof(Staff);
    public const string Admin      = nameof(Admin);

    // Combinaisons pour [Authorize(Roles = Roles.StaffOrAbove)]
    public const string StaffOrAbove = $"{Staff},{Admin}";
    public const string All          = $"{Customer},{Staff},{Admin}";
}
```

---

## Interfaces/

### `Interfaces/ISoftDeletable.cs`

Marqueur que le `SoftDeleteInterceptor` (Infrastructure) surveille.
Toute entité qui implémente cette interface sera soft-deletée automatiquement.

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Interfaces;

public interface ISoftDeletable
{
    bool      IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}
```

### `Interfaces/IAuditableEntity.cs`

Rempli automatiquement par `AuditInterceptor` (Infrastructure).

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Interfaces;

public interface IAuditableEntity
{
    DateTime  CreatedAt { get; set; }
    string?   CreatedBy { get; set; }  // Email de l'auteur
    DateTime? UpdatedAt { get; set; }
    string?   UpdatedBy { get; set; }
}
```

---

## Exceptions/

Convention : les handlers lancent ces exceptions, le `GlobalExceptionHandler` (Api)
les mappe vers les codes HTTP appropriés.

> Les quatre exceptions sont regroupées dans **UN SEUL fichier**
> `Exceptions/DomainExceptions.cs` (pas un fichier par exception).

### `Exceptions/DomainExceptions.cs`
```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Exceptions;

/// <summary>→ HTTP 404</summary>
public sealed class NotFoundException(string name, object key)
    : Exception($"Ressource « {name} » avec la clé « {key} » introuvable.");

/// <summary>→ HTTP 409 (ex: slug déjà utilisé)</summary>
public sealed class ConflictException(string message)
    : Exception(message);

/// <summary>→ HTTP 403 (authentifié mais pas autorisé)</summary>
public sealed class ForbiddenException(string message)
    : Exception(message);

/// <summary>→ HTTP 422 (règle métier violée)</summary>
public sealed class BusinessRuleException(string message)
    : Exception(message);
```

---

## Enums/

```csharp
// Enums/OrderStatus.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum OrderStatus
{
    Pending   = 0,   // En attente de paiement
    Confirmed = 1,   // Paiement reçu
    Shipped   = 2,   // Expédiée / en livraison
    Delivered = 3,   // Livrée
    Cancelled = 4,   // Annulée
}

// Enums/DeliveryType.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum DeliveryType
{
    Pickup   = 0,   // Ramassage en magasin/entrepôt
    Delivery = 1,   // Livraison à domicile
}

// Enums/RentalStatus.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum RentalStatus
{
    Active    = 0,
    Expired   = 1,
    Cancelled = 2,
}

// Enums/BookingStatus.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum BookingStatus
{
    Pending   = 0,
    Confirmed = 1,
    Completed = 2,
    Cancelled = 3,
}

// Enums/BookingType.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum BookingType
{
    Installation = 0,   // Pose d'un abri acheté ou loué
    Delivery     = 1,   // Livraison seule
    Removal      = 2,   // Démontage / récupération
}
```

---

## ValueObjects/

Les Value Objects sont **immuables** : égalité par valeur, pas par référence.
EF Core les configure comme **Owned Entities** (colonnes dans la table propriétaire).

### `ValueObjects/Address.cs`

Défini UNE SEULE FOIS dans Domain. Utilisé par :
- `Order.ShippingAddress` (snapshot à la commande)
- `BookingSlot.Address` (adresse d'installation)
- `AppUser.DefaultDeliveryAddress` (Infrastructure peut référencer Domain ✅)

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.ValueObjects;

/// <summary>
/// Adresse immuable — Owned Entity dans EF Core.
/// La table propriétaire reçoit des colonnes préfixées (ex: ShippingAddress_Street).
/// </summary>
public sealed class Address
{
    public string Street     { get; init; } = string.Empty;
    public string City       { get; init; } = string.Empty;
    public string Province   { get; init; } = "QC";
    public string PostalCode { get; init; } = string.Empty;
    public string Country    { get; init; } = "Canada";

    private Address() { }  // EF Core

    public static Address Create(
        string street, string city, string province, string postalCode,
        string country = "Canada")
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(street);
        ArgumentException.ThrowIfNullOrWhiteSpace(city);
        ArgumentException.ThrowIfNullOrWhiteSpace(postalCode);

        return new Address
        {
            Street     = street.Trim(),
            City       = city.Trim(),
            Province   = province.Trim().ToUpperInvariant(),
            PostalCode = postalCode.Trim().ToUpperInvariant(),
            Country    = country.Trim(),
        };
    }

    public override string ToString()
        => $"{Street}, {City} ({Province}) {PostalCode}, {Country}";
}
```

### `ValueObjects/Money.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.ValueObjects;

public sealed class Money
{
    public decimal Amount   { get; init; }
    public string  Currency { get; init; } = "CAD";

    private Money() { }

    public static Money Of(decimal amount, string currency = "CAD")
    {
        if (amount < 0)
            throw new ArgumentException("Le montant ne peut pas être négatif.", nameof(amount));
        return new Money { Amount = amount, Currency = currency };
    }

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new BusinessRuleException("Impossible d'additionner des devises différentes.");
        return Of(Amount + other.Amount, Currency);
    }

    public Money Multiply(int quantity) => Of(Amount * quantity, Currency);

    public override string ToString() => $"{Amount:F2} {Currency}";
}
```

### `ValueObjects/PhoneNumber.cs`

Présent dans le projet mais encore à l'état d'**ébauche** (classe vide). À compléter
sur le même modèle immuable qu'`Address`/`Money` (factory `Create`, validation du format).

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.ValueObjects;

public class PhoneNumber
{
}
```

---

## Entities/

Les entités Domain encapsulent les règles métier. Le constructeur est privé —
seule la méthode factory statique `Create()` peut créer un état valide.

### `Entities/ProductCategory.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

public sealed class ProductCategory : IAuditableEntity
{
    // Données de référence — peut être Enum ou entité selon la flexibilité souhaitée
    public Guid   Id   { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;

    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

    private ProductCategory() { }

    public static ProductCategory Create(string name, string slug) =>
        new() { Id = Guid.NewGuid(), Name = name, Slug = slug };
}
```

### `Entities/Product.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Produit du catalogue (abri simple, double, toile de remplacement, accessoire).
/// Règles métier : prix positif, stock >= 0, slug unique (validé dans le handler).
/// </summary>
public sealed class Product : ISoftDeletable, IAuditableEntity
{
    private readonly List<ProductImage> _images = [];

    public Guid     Id          { get; private set; }
    public string   Name        { get; private set; } = string.Empty;
    public string   Slug        { get; private set; } = string.Empty;
    public string?  Description { get; private set; }
    public decimal  Price       { get; private set; }
    public decimal? RentalPrice { get; private set; }  // null = non louable
    public int      Stock       { get; private set; }
    public bool     IsAvailable { get; private set; }
    public Guid     CategoryId  { get; private set; }

    public ProductCategory        Category { get; private set; } = null!;
    public IReadOnlyList<ProductImage> Images => _images.AsReadOnly();

    // ISoftDeletable
    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    // IAuditableEntity
    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

    private Product() { }

    public static Product Create(
        string name, string slug, decimal price, int stock,
        Guid categoryId, string? description = null, decimal? rentalPrice = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        if (price <= 0)  throw new ArgumentException("Prix doit être positif.");
        if (stock < 0)   throw new ArgumentException("Stock ne peut pas être négatif.");

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
        if (price <= 0) throw new ArgumentException("Prix doit être positif.");
        Name = name.Trim(); Description = description?.Trim(); Price = price;
    }

    public void AdjustStock(int delta)
    {
        var next = Stock + delta;
        if (next < 0) throw new BusinessRuleException("Stock ne peut pas être négatif.");
        Stock = next; IsAvailable = next > 0;
    }

    public void AddImage(string url, string? altText = null)
        => _images.Add(ProductImage.Create(Id, url, altText));
}
```

### `Entities/ProductImage.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

public sealed class ProductImage
{
    public Guid    Id        { get; private set; }
    public Guid    ProductId { get; private set; }
    public string  Url       { get; private set; } = string.Empty;
    public string? AltText   { get; private set; }
    public int     SortOrder { get; private set; }

    private ProductImage() { }

    internal static ProductImage Create(Guid productId, string url, string? altText = null)
        => new() { Id = Guid.NewGuid(), ProductId = productId, Url = url, AltText = altText };
}
```

### `Entities/Order.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Agrégat commande.
/// CustomerId = Guid référençant AppUser.Id (pas de navigation Domain → Infrastructure).
/// La FK EF est configurée dans Infrastructure/Persistence/Configurations/OrderConfiguration.
/// </summary>
public sealed class Order : ISoftDeletable, IAuditableEntity
{
    private readonly List<OrderLine> _lines = [];

    public Guid         Id             { get; private set; }
    public Guid         CustomerId     { get; private set; }  // réf AppUser.Id
    public OrderStatus  Status         { get; private set; }
    public DeliveryType DeliveryType   { get; private set; }
    public Address?     ShippingAddress { get; private set; } // null si ramassage
    public decimal      TotalAmount    { get; private set; }
    public string?      Notes          { get; private set; }

    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();

    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

    private Order() { }

    public static Order Create(
        Guid customerId, DeliveryType deliveryType,
        IReadOnlyList<(Product Product, int Qty)> items,
        Address? shippingAddress = null,
        string? notes = null)
    {
        if (!items.Any())
            throw new BusinessRuleException("Une commande doit contenir au moins un produit.");

        if (deliveryType == DeliveryType.Delivery && shippingAddress is null)
            throw new BusinessRuleException("Une adresse de livraison est requise.");

        var order = new Order
        {
            Id             = Guid.NewGuid(),
            CustomerId     = customerId,
            Status         = OrderStatus.Pending,
            DeliveryType   = deliveryType,
            ShippingAddress = shippingAddress,
            Notes          = notes?.Trim(),
        };

        foreach (var (product, qty) in items)
        {
            if (!product.IsAvailable)
                throw new BusinessRuleException($"« {product.Name} » n'est plus disponible.");
            order._lines.Add(OrderLine.Create(order.Id, product, qty));
        }

        order.TotalAmount = order._lines.Sum(l => l.LineTotal);
        return order;
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new BusinessRuleException("Seule une commande en attente peut être confirmée.");
        Status = OrderStatus.Confirmed;
    }

    public void Cancel()
    {
        if (Status is OrderStatus.Delivered or OrderStatus.Shipped)
            throw new BusinessRuleException("Impossible d'annuler une commande déjà expédiée.");
        Status = OrderStatus.Cancelled;
    }
}
```

### `Entities/OrderLine.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Snapshot d'un produit au moment de la commande.
/// Prix et nom sont copiés — immuables même si le produit change après.
/// </summary>
public sealed class OrderLine
{
    public Guid    Id           { get; private set; }
    public Guid    OrderId      { get; private set; }
    public Guid    ProductId    { get; private set; }
    public string  ProductName  { get; private set; } = string.Empty;  // snapshot
    public decimal UnitPrice    { get; private set; }                  // snapshot
    public int     Quantity     { get; private set; }
    public decimal LineTotal    { get; private set; }

    private OrderLine() { }

    internal static OrderLine Create(Guid orderId, Product product, int qty)
    {
        if (qty <= 0) throw new ArgumentException("Quantité doit être positive.");
        return new OrderLine
        {
            Id          = Guid.NewGuid(),
            OrderId     = orderId,
            ProductId   = product.Id,
            ProductName = product.Name,
            UnitPrice   = product.Price,
            Quantity    = qty,
            LineTotal   = product.Price * qty,
        };
    }
}
```

### `Entities/RentalContract.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Contrat de location d'un abri temporaire.
/// CustomerId = Guid référençant AppUser.Id.
/// </summary>
public sealed class RentalContract : ISoftDeletable, IAuditableEntity
{
    public Guid         Id            { get; private set; }
    public Guid         CustomerId    { get; private set; }
    public Guid         ProductId     { get; private set; }
    public string       ProductName   { get; private set; } = string.Empty; // snapshot
    public decimal      MonthlyRate   { get; private set; }
    public DateOnly     StartDate     { get; private set; }
    public DateOnly     EndDate       { get; private set; }
    public RentalStatus Status        { get; private set; }
    public Address      Address       { get; private set; } = null!;  // adresse d'installation

    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

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
            Id          = Guid.NewGuid(),
            CustomerId  = customerId,
            ProductId   = product.Id,
            ProductName = product.Name,
            MonthlyRate = product.RentalPrice.Value,
            StartDate   = startDate,
            EndDate     = endDate,
            Status      = RentalStatus.Active,
            Address     = address,
        };
    }

    public void Cancel()
    {
        if (Status == RentalStatus.Expired)
            throw new BusinessRuleException("Impossible d'annuler un contrat expiré.");
        Status = RentalStatus.Cancelled;
    }
}
```

### `Entities/BookingSlot.cs`

```csharp
namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Créneau d'installation, livraison ou démontage.
/// CustomerId = Guid référençant AppUser.Id.
/// </summary>
public sealed class BookingSlot : ISoftDeletable, IAuditableEntity
{
    public Guid          Id          { get; private set; }
    public Guid          CustomerId  { get; private set; }
    public Guid?         OrderId     { get; private set; }
    public DateTime      SlotStart   { get; private set; }
    public int           DurationMin { get; private set; }
    public BookingType   Type        { get; private set; }
    public BookingStatus Status      { get; private set; }
    public Address       Address     { get; private set; } = null!;
    public string?       Notes       { get; private set; }

    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime  CreatedAt { get; set; }
    public string?   CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }

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
            Id          = Guid.NewGuid(),
            CustomerId  = customerId,
            OrderId     = orderId,
            SlotStart   = slotStart,
            DurationMin = durationMin,
            Type        = type,
            Status      = BookingStatus.Pending,
            Address     = address,
            Notes       = notes?.Trim(),
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
```

---

## Events/

Les Domain Events signalent qu'une chose importante s'est produite.
Ils peuvent déclencher des effets secondaires (email, mise à jour d'un agrégat voisin).

```csharp
// Events/IDomainEvent.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Events;

public interface IDomainEvent { }

// Events/OrderPlacedEvent.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Events;

public sealed record OrderPlacedEvent(
    Guid   OrderId,
    Guid   CustomerId,
    decimal TotalAmount) : IDomainEvent;

// Events/BookingConfirmedEvent.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Events;

public sealed record BookingConfirmedEvent(
    Guid     BookingId,
    Guid     CustomerId,
    DateTime SlotStart,
    Address  Address) : IDomainEvent;

// Events/RentalCreatedEvent.cs
namespace AbrisAutoOutaouais_WebApp.Domain.Events;

public sealed record RentalCreatedEvent(
    Guid     RentalId,
    Guid     CustomerId,
    Guid     ProductId,
    DateOnly StartDate,
    DateOnly EndDate) : IDomainEvent;
```

---

## Récapitulatif — ce qui appartient (et n'appartient PAS) à Domain

| ✅ Appartient à Domain | ❌ N'appartient PAS à Domain |
|------------------------|------------------------------|
| Entités avec règles métier | AppUser / IdentityUser |
| Value Objects immuables | DbContext / DbSet |
| Enums métier | Services HTTP |
| Exceptions métier | FluentValidation |
| Interfaces `ISoftDeletable`, `IAuditableEntity` | IEmailService |
| Domain Events | JWT / Claims |
| `Domain.Constants.Roles` | Toute entité sans règle métier (tables de lookup pures) |
