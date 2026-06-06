# LAYER_TESTS.md — Tests Backend (xUnit)

Guide complet des tests unitaires et d'intégration pour les couches Domain, Application et Api.

---

## Philosophie

```
Tests unitaires  → Domain (zéro mock — règles métier pures)
Tests unitaires  → Application handlers (DbContext InMemory — pas d'IO)
Tests unitaires  → Validateurs FluentValidation
Tests d'intégration → Api endpoints (WebApplicationFactory — vraie HTTP stack)
```

**Règle** : si un test a besoin de mocks complexes, c'est souvent un signal que
l'architecture peut être simplifiée. Les entités Domain sont testables en isolation totale.

---

## Arborescence complète

```
tests/
├── Unit/
│   ├── Unit.csproj
│   ├── GlobalUsings.cs                     ← using globaux (xUnit, FluentAssertions)
│   ├── Domain/
│   │   ├── ProductTests.cs                 ← tests entité Product
│   │   ├── OrderTests.cs                   ← tests agrégat Order
│   │   ├── BookingSlotTests.cs             ← tests BookingSlot
│   │   ├── RentalContractTests.cs
│   │   └── AddressTests.cs                 ← tests Value Object
│   └── Application/
│       ├── Handlers/
│       │   ├── Products/
│       │   │   ├── CreateProductCommandHandlerTests.cs
│       │   │   └── GetProductBySlugQueryHandlerTests.cs
│       │   ├── Orders/
│       │   │   └── PlaceOrderCommandHandlerTests.cs
│       │   └── Bookings/
│       │       └── CreateBookingCommandHandlerTests.cs
│       └── Validators/
│           ├── CreateProductCommandValidatorTests.cs
│           ├── PlaceOrderCommandValidatorTests.cs
│           └── RegisterCommandValidatorTests.cs
│
└── Integration/
    ├── Integration.csproj
    ├── GlobalUsings.cs
    ├── Helpers/
    │   ├── WebAppFactory.cs                ← WebApplicationFactory<Program>
    │   ├── AuthHelper.cs                   ← génère des tokens JWT pour les tests
    │   └── DbHelper.cs                     ← seed et reset de la DB de test
    ├── Products/
    │   └── ProductsEndpointTests.cs
    ├── Orders/
    │   └── OrdersEndpointTests.cs
    └── Auth/
        └── AuthEndpointTests.cs
```

---

## Fichiers de projet

### `tests/Unit/Unit.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
    <!-- Parallélisme désactivé si les tests partagent un contexte In-Memory -->
    <ParallelizeTestCollections>true</ParallelizeTestCollections>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\src\Domain\Domain.csproj" />
    <ProjectReference Include="..\..\src\Application\Application.csproj" />
    <ProjectReference Include="..\..\src\Infrastructure\Infrastructure.csproj" />
    <PackageReference Include="xunit"                               Version="2.*" />
    <PackageReference Include="xunit.runner.visualstudio"          Version="3.*" />
    <PackageReference Include="FluentAssertions"                    Version="7.*" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.*" />
    <PackageReference Include="NSubstitute"                         Version="5.*" />
    <PackageReference Include="FluentValidation.TestHelper"         Version="12.*" />
    <PackageReference Include="coverlet.collector"                  Version="6.*" />
  </ItemGroup>
</Project>
```

### `tests/Integration/Integration.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\src\Api\Api.csproj" />
    <PackageReference Include="xunit"                               Version="2.*" />
    <PackageReference Include="xunit.runner.visualstudio"          Version="3.*" />
    <PackageReference Include="FluentAssertions"                    Version="7.*" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing"    Version="10.*" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="10.*" />
    <PackageReference Include="coverlet.collector"                  Version="6.*" />
  </ItemGroup>
</Project>
```

---

## `GlobalUsings.cs` (les deux projets)

```csharp
// tests/Unit/GlobalUsings.cs
global using Xunit;
global using FluentAssertions;
global using NSubstitute;
global using Domain.Entities;
global using Domain.Exceptions;
global using Domain.ValueObjects;
global using Domain.Enums;
global using Application.Common.Mediator;
global using Application.Common.Interfaces;
global using Microsoft.EntityFrameworkCore;

// tests/Integration/GlobalUsings.cs
global using Xunit;
global using FluentAssertions;
global using System.Net;
global using System.Net.Http.Json;
global using Application.Auth.DTOs;
global using Application.Products.Queries.GetProductBySlug;
global using Integration.Helpers;
```

---

## Tests Domain (aucun mock nécessaire)

### `Unit/Domain/ProductTests.cs`

```csharp
namespace Unit.Domain;

/// <summary>
/// Tests unitaires de l'entité Product.
/// Aucune dépendance externe — tests purement fonctionnels.
/// </summary>
public sealed class ProductTests
{
    // ── Factory ───────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithValidData_ReturnsProductWithCorrectState()
    {
        var categoryId = Guid.NewGuid();

        var product = Product.Create(
            name: "Abri Simple",
            slug: "abri-simple",
            price: 299.99m,
            stock: 10,
            categoryId: categoryId,
            description: "Abri une voiture");

        product.Name.Should().Be("Abri Simple");
        product.Slug.Should().Be("abri-simple");
        product.Price.Should().Be(299.99m);
        product.Stock.Should().Be(10);
        product.IsAvailable.Should().BeTrue();
        product.CategoryId.Should().Be(categoryId);
        product.IsDeleted.Should().BeFalse();
        product.Id.Should().NotBeEmpty();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Create_WithEmptyName_Throws(string? name)
    {
        var act = () => Product.Create(name!, "slug", 100m, 5, Guid.NewGuid());

        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public void Create_WithNonPositivePrice_Throws(decimal price)
    {
        var act = () => Product.Create("Abri", "abri", price, 5, Guid.NewGuid());

        act.Should().Throw<ArgumentException>()
            .WithMessage("*prix*");
    }

    [Fact]
    public void Create_WithZeroStock_IsUnavailable()
    {
        var product = Product.Create("Abri", "abri", 100m, 0, Guid.NewGuid());

        product.IsAvailable.Should().BeFalse();
        product.Stock.Should().Be(0);
    }

    [Fact]
    public void Create_SlugIsNormalizedToLowercase()
    {
        var product = Product.Create("Abri", "ABRI-SIMPLE", 100m, 5, Guid.NewGuid());

        product.Slug.Should().Be("abri-simple");
    }

    // ── AdjustStock ───────────────────────────────────────────────────────────

    [Fact]
    public void AdjustStock_WithPositiveDelta_IncreasesStock()
    {
        var product = Product.Create("Abri", "abri", 100m, 5, Guid.NewGuid());

        product.AdjustStock(3);

        product.Stock.Should().Be(8);
        product.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void AdjustStock_ToExactlyZero_SetsUnavailable()
    {
        var product = Product.Create("Abri", "abri", 100m, 2, Guid.NewGuid());

        product.AdjustStock(-2);

        product.Stock.Should().Be(0);
        product.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void AdjustStock_BelowZero_ThrowsBusinessRuleException()
    {
        var product = Product.Create("Abri", "abri", 100m, 1, Guid.NewGuid());

        var act = () => product.AdjustStock(-5);

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*stock*");
    }

    // ── UpdateDetails ─────────────────────────────────────────────────────────

    [Fact]
    public void UpdateDetails_WithValidData_UpdatesProperties()
    {
        var product = Product.Create("Ancien nom", "slug", 100m, 5, Guid.NewGuid());

        product.UpdateDetails("Nouveau nom", "Nouvelle description", 149.99m);

        product.Name.Should().Be("Nouveau nom");
        product.Description.Should().Be("Nouvelle description");
        product.Price.Should().Be(149.99m);
    }

    [Fact]
    public void UpdateDetails_WithNegativePrice_Throws()
    {
        var product = Product.Create("Abri", "abri", 100m, 5, Guid.NewGuid());

        var act = () => product.UpdateDetails("Abri", null, -1m);

        act.Should().Throw<ArgumentException>();
    }
}
```

---

### `Unit/Domain/OrderTests.cs`

```csharp
namespace Unit.Domain;

public sealed class OrderTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Product MakeProduct(decimal price = 100m, int stock = 5)
        => Product.Create("Abri", "abri", price, stock, Guid.NewGuid());

    private static Address MakeAddress()
        => Address.Create("123 rue des Érables", "Saint-Jérôme", "QC", "J7Z1A1");

    // ── Create ────────────────────────────────────────────────────────────────

    [Fact]
    public void Create_WithPickup_DoesNotRequireAddress()
    {
        var product = MakeProduct();
        var items   = new[] { (product, 2) }.ToList<(Product, int)>();

        var order = Order.Create(Guid.NewGuid(), DeliveryType.Pickup, items);

        order.Should().NotBeNull();
        order.DeliveryType.Should().Be(DeliveryType.Pickup);
        order.ShippingAddress.Should().BeNull();
        order.Status.Should().Be(OrderStatus.Pending);
    }

    [Fact]
    public void Create_WithDelivery_RequiresAddress()
    {
        var product = MakeProduct();
        var items   = new[] { (product, 1) }.ToList<(Product, int)>();

        var act = () => Order.Create(Guid.NewGuid(), DeliveryType.Delivery, items);

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*adresse*");
    }

    [Fact]
    public void Create_WithDeliveryAndAddress_Succeeds()
    {
        var product = MakeProduct(price: 200m);
        var items   = new[] { (product, 3) }.ToList<(Product, int)>();
        var address = MakeAddress();

        var order = Order.Create(Guid.NewGuid(), DeliveryType.Delivery, items, address);

        order.TotalAmount.Should().Be(600m);   // 200 * 3
        order.Lines.Should().HaveCount(1);
        order.ShippingAddress.Should().NotBeNull();
    }

    [Fact]
    public void Create_WithEmptyItems_Throws()
    {
        var act = () => Order.Create(
            Guid.NewGuid(), DeliveryType.Pickup,
            new List<(Product, int)>());

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*au moins un produit*");
    }

    [Fact]
    public void Create_WithUnavailableProduct_Throws()
    {
        var product = Product.Create("Abri", "abri", 100m, 0, Guid.NewGuid()); // stock 0
        var items   = new[] { (product, 1) }.ToList<(Product, int)>();

        var act = () => Order.Create(Guid.NewGuid(), DeliveryType.Pickup, items);

        act.Should().Throw<BusinessRuleException>()
            .WithMessage("*disponible*");
    }

    // ── TotalAmount ───────────────────────────────────────────────────────────

    [Theory]
    [InlineData(100, 1, 100)]
    [InlineData(50,  3, 150)]
    [InlineData(299.99, 2, 599.98)]
    public void Create_TotalAmountIsCorrect(decimal price, int qty, decimal expected)
    {
        var product = MakeProduct(price: price);
        var items   = new[] { (product, qty) }.ToList<(Product, int)>();

        var order = Order.Create(Guid.NewGuid(), DeliveryType.Pickup, items);

        order.TotalAmount.Should().Be(expected);
    }

    // ── Status transitions ────────────────────────────────────────────────────

    [Fact]
    public void Confirm_FromPending_ChangesStatusToConfirmed()
    {
        var product = MakeProduct();
        var order   = Order.Create(Guid.NewGuid(), DeliveryType.Pickup,
            new[] { (product, 1) }.ToList<(Product, int)>());

        order.Confirm();

        order.Status.Should().Be(OrderStatus.Confirmed);
    }

    [Fact]
    public void Confirm_FromConfirmed_Throws()
    {
        var product = MakeProduct();
        var order   = Order.Create(Guid.NewGuid(), DeliveryType.Pickup,
            new[] { (product, 1) }.ToList<(Product, int)>());

        order.Confirm();
        var act = () => order.Confirm();

        act.Should().Throw<BusinessRuleException>();
    }

    [Fact]
    public void Cancel_FromPending_Succeeds()
    {
        var product = MakeProduct();
        var order   = Order.Create(Guid.NewGuid(), DeliveryType.Pickup,
            new[] { (product, 1) }.ToList<(Product, int)>());

        order.Cancel();

        order.Status.Should().Be(OrderStatus.Cancelled);
    }
}
```

---

### `Unit/Domain/AddressTests.cs`

```csharp
namespace Unit.Domain;

public sealed class AddressTests
{
    [Fact]
    public void Create_NormalizesProvinceToUppercase()
    {
        var address = Address.Create("123 rue", "Montréal", "qc", "h2x1y3");

        address.Province.Should().Be("QC");
        address.PostalCode.Should().Be("H2X1Y3");
    }

    [Theory]
    [InlineData("", "Montréal", "QC", "H2X1Y3")]
    [InlineData("123 rue", "", "QC", "H2X1Y3")]
    [InlineData("123 rue", "Montréal", "QC", "")]
    public void Create_WithMissingRequiredField_Throws(
        string street, string city, string province, string postalCode)
    {
        var act = () => Address.Create(street, city, province, postalCode);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_TrimsWhitespace()
    {
        var address = Address.Create("  123 rue  ", "  Montréal  ", "QC", "  H2X 1Y3  ");

        address.Street.Should().Be("123 rue");
        address.City.Should().Be("Montréal");
    }
}
```

---

## Tests Application (handlers avec InMemory DbContext)

### `Unit/Application/Helpers/InMemoryDbContext.cs`

```csharp
namespace Unit.Application.Helpers;

/// <summary>
/// Factory pour créer un ApplicationDbContext en mémoire pour les tests.
/// Chaque test reçoit une instance isolée avec un nom unique.
/// </summary>
public static class TestDbContextFactory
{
    public static ApplicationDbContext Create()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()) // Isolation par test
            .Options;

        // Interceptors minimaux pour les tests
        var softDelete = new SoftDeleteInterceptor();
        var audit      = new AuditInterceptor(null);  // null = pas de currentUser en test

        var context = new ApplicationDbContext(options, softDelete, audit);
        context.Database.EnsureCreated();
        return context;
    }
}
```

---

### `Unit/Application/Handlers/Products/CreateProductCommandHandlerTests.cs`

```csharp
namespace Unit.Application.Handlers.Products;

public sealed class CreateProductCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<Guid> SeedCategoryAsync()
    {
        var cat = ProductCategory.Create("Abris", "abris");
        _db.ProductCategories.Add(cat);
        await _db.SaveChangesAsync();
        return cat.Id;
    }

    private CreateProductCommandHandler CreateHandler()
        => new(_db, new DateTimeProvider());

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_WithValidCommand_CreatesProductAndReturnsId()
    {
        var categoryId = await SeedCategoryAsync();
        var cmd = new CreateProductCommand(
            Name: "Abri Simple",
            Slug: "abri-simple",
            Price: 299.99m,
            Stock: 10,
            CategoryId: categoryId);

        var handler = CreateHandler();
        var id      = await handler.Handle(cmd, CancellationToken.None);

        id.Should().NotBeEmpty();

        var saved = await _db.Products.FindAsync(id);
        saved.Should().NotBeNull();
        saved!.Name.Should().Be("Abri Simple");
        saved.Price.Should().Be(299.99m);
    }

    [Fact]
    public async Task Handle_WithDuplicateSlug_ThrowsConflictException()
    {
        var categoryId = await SeedCategoryAsync();

        // Premier produit
        await CreateHandler().Handle(
            new CreateProductCommand("Abri 1", "abri-simple", 100m, 5, categoryId),
            CancellationToken.None);

        // Deuxième avec le même slug
        var act = async () => await CreateHandler().Handle(
            new CreateProductCommand("Abri 2", "abri-simple", 200m, 3, categoryId),
            CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*slug*");
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    public void Dispose() => _db.Dispose();
}
```

---

### `Unit/Application/Handlers/Products/GetProductBySlugQueryHandlerTests.cs`

```csharp
namespace Unit.Application.Handlers.Products;

public sealed class GetProductBySlugQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    private async Task<Product> SeedProductAsync(string slug = "abri-test")
    {
        var cat     = ProductCategory.Create("Abris", "abris");
        var product = Product.Create("Abri Test", slug, 150m, 3, cat.Id);
        _db.ProductCategories.Add(cat);
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return product;
    }

    [Fact]
    public async Task Handle_WithExistingSlug_ReturnsProductDto()
    {
        await SeedProductAsync("mon-abri");
        var handler = new GetProductBySlugQueryHandler(_db);

        var result = await handler.Handle(
            new GetProductBySlugQuery("mon-abri"), CancellationToken.None);

        result.Should().NotBeNull();
        result.Slug.Should().Be("mon-abri");
        result.Name.Should().Be("Abri Test");
        result.Price.Should().Be(150m);
    }

    [Fact]
    public async Task Handle_WithUnknownSlug_ThrowsNotFoundException()
    {
        var handler = new GetProductBySlugQueryHandler(_db);

        var act = async () => await handler.Handle(
            new GetProductBySlugQuery("inexistant"), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_SoftDeletedProduct_NotReturned()
    {
        var product = await SeedProductAsync("soft-deleted");
        product.IsDeleted = true;
        await _db.SaveChangesAsync();

        var handler = new GetProductBySlugQueryHandler(_db);
        var act = async () => await handler.Handle(
            new GetProductBySlugQuery("soft-deleted"), CancellationToken.None);

        // HasQueryFilter(p => !p.IsDeleted) exclut le produit
        await act.Should().ThrowAsync<NotFoundException>();
    }

    public void Dispose() => _db.Dispose();
}
```

---

### `Unit/Application/Handlers/Bookings/CreateBookingCommandHandlerTests.cs`

```csharp
namespace Unit.Application.Handlers.Bookings;

public sealed class CreateBookingCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db        = TestDbContextFactory.Create();
    private readonly ICurrentUserService  _user      = Substitute.For<ICurrentUserService>();
    private readonly IEmailService        _email     = Substitute.For<IEmailService>();
    private readonly Guid                 _userId    = Guid.NewGuid();

    public CreateBookingCommandHandlerTests()
    {
        _user.UserId.Returns(_userId);
        _user.Email.Returns("client@test.com");
        _user.IsAuthenticated.Returns(true);
    }

    private CreateBookingCommandHandler CreateHandler()
        => new(_db, _user, _email);

    private static CreateBookingCommand MakeCmd(DateTime? slotStart = null) =>
        new(
            SlotStart:   slotStart ?? DateTime.UtcNow.AddDays(3),
            DurationMin: 120,
            Type:        BookingType.Installation,
            Street:      "123 rue des Pins",
            City:        "Mirabel",
            Province:    "QC",
            PostalCode:  "J7J1A1");

    [Fact]
    public async Task Handle_WithFutureSlot_CreatesBooking()
    {
        var id = await CreateHandler().Handle(MakeCmd(), CancellationToken.None);

        id.Should().NotBeEmpty();
        var booking = await _db.BookingSlots.FindAsync(id);
        booking.Should().NotBeNull();
        booking!.CustomerId.Should().Be(_userId);
        booking.Status.Should().Be(BookingStatus.Pending);
    }

    [Fact]
    public async Task Handle_WithConflictingSlot_ThrowsConflictException()
    {
        var slotStart = DateTime.UtcNow.AddDays(5);

        // Premier créneau
        await CreateHandler().Handle(MakeCmd(slotStart), CancellationToken.None);

        // Même créneau — conflit
        var act = async () =>
            await CreateHandler().Handle(MakeCmd(slotStart), CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*créneau*");
    }

    [Fact]
    public async Task Handle_Succeeds_SendsConfirmationEmail()
    {
        await CreateHandler().Handle(MakeCmd(), CancellationToken.None);

        await _email.Received(1)
            .SendBookingConfirmationAsync(
                Arg.Any<Guid>(),
                "client@test.com",
                Arg.Any<CancellationToken>());
    }

    public void Dispose() => _db.Dispose();
}
```

---

## Tests validateurs FluentValidation

### `Unit/Application/Validators/CreateProductCommandValidatorTests.cs`

```csharp
namespace Unit.Application.Validators;

/// <summary>FluentValidation.TestHelper rend les tests de validateurs très lisibles.</summary>
public sealed class CreateProductCommandValidatorTests
{
    private readonly CreateProductCommandValidator _validator = new();

    [Fact]
    public void Validate_WithValidCommand_HasNoValidationErrors()
    {
        var cmd = new CreateProductCommand(
            Name: "Abri Simple",
            Slug: "abri-simple",
            Price: 299.99m,
            Stock: 5,
            CategoryId: Guid.NewGuid());

        var result = _validator.TestValidate(cmd);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_WithEmptyName_HasValidationError(string name)
    {
        var cmd = new CreateProductCommand(name, "slug", 100m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_WithInvalidSlugFormat_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "Slug Invalide!", 100m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Slug)
            .WithErrorMessage("*minuscules*");
    }

    [Fact]
    public void Validate_WithZeroPrice_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 0m, 5, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Price);
    }

    [Fact]
    public void Validate_WithNegativeStock_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 100m, -1, Guid.NewGuid());

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.Stock);
    }

    [Fact]
    public void Validate_WithPositiveRentalPrice_HasNoError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 100m, 5, Guid.NewGuid(),
            RentalPrice: 50m);

        _validator.TestValidate(cmd)
            .ShouldNotHaveValidationErrorFor(x => x.RentalPrice);
    }

    [Fact]
    public void Validate_WithZeroRentalPrice_HasValidationError()
    {
        var cmd = new CreateProductCommand("Abri", "abri", 100m, 5, Guid.NewGuid(),
            RentalPrice: 0m);

        _validator.TestValidate(cmd)
            .ShouldHaveValidationErrorFor(x => x.RentalPrice);
    }
}
```

---

## Tests d'intégration

### `Integration/Helpers/WebAppFactory.cs`

```csharp
namespace Integration.Helpers;

/// <summary>
/// WebApplicationFactory remplace le vrai serveur et la vraie DB par des versions contrôlées.
/// Partage une seule instance entre tous les tests de la collection (performance).
/// </summary>
public sealed class WebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public HttpClient Client { get; private set; } = null!;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remplacer le DbContext SQL Server par une DB InMemory
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor is not null)
                services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(opts =>
                opts.UseInMemoryDatabase("IntegrationTestDb"));

            // Remplacer le service email par un mock (pas d'envoi réel)
            services.AddScoped<IEmailService>(_ => Substitute.For<IEmailService>());
        });

        builder.UseEnvironment("Test");
    }

    public async Task InitializeAsync()
    {
        Client = CreateClient();

        // Seed initial via le seeder
        using var scope    = Services.CreateScope();
        var db             = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userManager    = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager    = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();

        await db.Database.EnsureCreatedAsync();
        await IdentitySeeder.SeedAsync(Services);
    }

    public new Task DisposeAsync() => Task.CompletedTask;
}
```

---

### `Integration/Helpers/AuthHelper.cs`

```csharp
namespace Integration.Helpers;

/// <summary>Génère des tokens JWT pour les tests d'intégration authentifiés.</summary>
public static class AuthHelper
{
    public static async Task<string> LoginAsAdminAsync(HttpClient client)
        => await LoginAsync(client, "admin@abristempo.local", "Admin@123!");

    public static async Task<string> LoginAsync(
        HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email, password });

        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        return auth!.Token;
    }

    /// <summary>Configure le client avec le header Authorization.</summary>
    public static void SetBearerToken(this HttpClient client, string token)
        => client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
}
```

---

### `Integration/Helpers/DbHelper.cs`

```csharp
namespace Integration.Helpers;

public static class DbHelper
{
    /// <summary>Seed d'une catégorie + produit pour les tests qui en ont besoin.</summary>
    public static async Task<(Guid CategoryId, Guid ProductId)> SeedProductAsync(
        IServiceProvider sp,
        string name  = "Abri Test",
        string slug  = "abri-test",
        decimal price = 199.99m,
        int stock     = 10)
    {
        using var scope = sp.CreateScope();
        var db          = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = ProductCategory.Create("Abris", "abris");
        var product  = Product.Create(name, slug, price, stock, category.Id);

        db.ProductCategories.Add(category);
        db.Products.Add(product);
        await db.SaveChangesAsync();

        return (category.Id, product.Id);
    }
}
```

---

### `Integration/Products/ProductsEndpointTests.cs`

```csharp
namespace Integration.Products;

/// <summary>
/// Tests de bout en bout pour les endpoints /api/v1/products.
/// Utilise une vraie HTTP stack, DB InMemory, JWT réel.
/// </summary>
[Collection("Integration")]  // Partage WebAppFactory — pas de parallélisme
public sealed class ProductsEndpointTests(WebAppFactory factory)
    : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client = factory.Client;

    // ── GET /api/v1/products ─────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_Anonymous_Returns200WithEmptyList()
    {
        var response = await _client.GetAsync("/api/v1/products");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PaginatedListDto<ProductSummaryDto>>();
        body.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAll_WithSeededProducts_ReturnsPaginatedList()
    {
        await DbHelper.SeedProductAsync(factory.Services, slug: "test-pagination");

        var response = await _client.GetAsync("/api/v1/products?page=1&pageSize=12");
        var body     = await response.Content.ReadFromJsonAsync<PaginatedListDto<ProductSummaryDto>>();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body!.Items.Should().NotBeEmpty();
    }

    // ── GET /api/v1/products/{slug} ─────────────────────────────────────────

    [Fact]
    public async Task GetBySlug_ExistingProduct_Returns200()
    {
        await DbHelper.SeedProductAsync(factory.Services, slug: "abri-unique-slug");

        var response = await _client.GetAsync("/api/v1/products/abri-unique-slug");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ProductDto>();
        dto!.Slug.Should().Be("abri-unique-slug");
    }

    [Fact]
    public async Task GetBySlug_UnknownSlug_Returns404WithProblemDetails()
    {
        var response = await _client.GetAsync("/api/v1/products/inexistant-xyz");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Vérifie que la réponse est bien un ProblemDetails RFC 9457
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(404);
        problem.Title.Should().Be("Ressource introuvable");
    }

    // ── POST /api/v1/products ────────────────────────────────────────────────

    [Fact]
    public async Task Create_AsAnonymous_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/products",
            new { name = "Test", slug = "test", price = 100, stock = 5, categoryId = Guid.NewGuid() });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_AsAdmin_Returns201WithId()
    {
        var token     = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        // Seeder une catégorie d'abord
        await DbHelper.SeedProductAsync(factory.Services, slug: "categorie-seed");
        var db       = factory.Services.CreateScope().ServiceProvider
            .GetRequiredService<ApplicationDbContext>();
        var catId    = await db.ProductCategories.Select(c => c.Id).FirstAsync();

        var response = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name        = "Abri Double Nouveau",
            slug        = "abri-double-nouveau",
            price       = 499.99,
            stock       = 3,
            categoryId  = catId,
            description = "Abri pour deux voitures",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = await response.Content.ReadFromJsonAsync<Guid>();
        id.Should().NotBeEmpty();

        // Nettoyage : reset le header
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_AsAdmin_WithInvalidData_Returns422()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name  = "",      // Invalide
            slug  = "SLUG INVALIDE!",  // Invalide
            price = -10,     // Invalide
            stock = -5,      // Invalide
            categoryId = Guid.Empty,  // Invalide
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
```

---

### `Integration/Auth/AuthEndpointTests.cs`

```csharp
namespace Integration.Auth;

[Collection("Integration")]
public sealed class AuthEndpointTests(WebAppFactory factory)
    : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client = factory.Client;

    [Fact]
    public async Task Login_WithValidCredentials_Returns200WithToken()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email    = "admin@abristempo.local",
            password = "Admin@123!",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        auth!.Token.Should().NotBeNullOrEmpty();
        auth.Roles.Should().Contain("Admin");
    }

    [Fact]
    public async Task Login_WithInvalidPassword_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email    = "admin@abristempo.local",
            password = "MauvaisMotDePasse",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Register_WithValidData_Returns200WithToken()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email           = $"nouveau-{Guid.NewGuid()}@test.com",
            firstName       = "Jean",
            lastName        = "Tremblay",
            password        = "Test@123!",
            confirmPassword = "Test@123!",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        auth!.Token.Should().NotBeNullOrEmpty();
        auth.Roles.Should().Contain("Customer");
    }

    [Fact]
    public async Task Register_WithPasswordMismatch_Returns422()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email           = "test@test.com",
            firstName       = "Jean",
            lastName        = "Tremblay",
            password        = "Test@123!",
            confirmPassword = "Différent@456!",  // Ne correspond pas
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetMe_WithValidToken_Returns200WithProfile()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        var response = await _client.GetAsync("/api/v1/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profile = await response.Content.ReadFromJsonAsync<UserProfileDto>();
        profile!.Email.Should().Be("admin@abristempo.local");

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetMe_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
```

---

## Commandes et conventions

### Exécuter les tests

```bash
# Tous les tests
dotnet test

# Seulement les tests unitaires
dotnet test tests/Unit/

# Seulement les tests d'intégration
dotnet test tests/Integration/

# Avec couverture de code
dotnet test --collect:"XPlat Code Coverage"
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coverage-report" -reporttypes:Html

# Filtrer par trait ou nom
dotnet test --filter "FullyQualifiedName~ProductTests"
dotnet test --filter "Category=Domain"
```

### Conventions de nommage

```
MethodName_Scenario_ExpectedResult

Exemples :
  Create_WithValidData_ReturnsProductWithCorrectState
  AdjustStock_BelowZero_ThrowsBusinessRuleException
  GetBySlug_UnknownSlug_Returns404WithProblemDetails
  Login_WithInvalidPassword_Returns401
```

### Organisation xUnit

```csharp
// Fact — test simple
[Fact] public void Test() { }

// Theory + InlineData — même logique, données différentes
[Theory]
[InlineData(0)]
[InlineData(-1)]
public void Test_WithInvalidValue(int value) { }

// Collection — partage l'instance de WebAppFactory
[Collection("Integration")]
public sealed class MyTests(WebAppFactory factory) : IClassFixture<WebAppFactory> { }

// IDisposable — nettoyage après chaque test
public sealed class MyTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    public void Dispose() => _db.Dispose();
}
```

---

## Récapitulatif — ce que chaque couche teste

| Couche | Type | Mocks | DB |
|--------|------|-------|-----|
| Domain entities | Unitaire | Aucun | Aucune |
| Domain value objects | Unitaire | Aucun | Aucune |
| Application handlers | Unitaire | `IEmailService`, `ICurrentUserService` via NSubstitute | EF InMemory |
| FluentValidation validators | Unitaire | Aucun | Aucune |
| Api endpoints | Intégration | `IEmailService` | EF InMemory (WebAppFactory) |
