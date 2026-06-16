using AbrisAutoOutaouais_WebApp.Application.Products.Commands;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Products;

public sealed class UpdateProductCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<Product> SeedProductAsync(string? brand = null, string? model = null)
    {
        var cat = ProductCategory.Create("Abris", "abris");
        var product = Product.Create(
            "Abri Test", "abri-test", 150m, 3, cat.Id, brand: brand, model: model);
        _db.ProductCategories.Add(cat);
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return product;
    }

    private UpdateProductCommandHandler CreateHandler() => new(_db);

    private UpdateProductCommand BaseCommand(Product product, string? brand, string? model)
        => new(
            Id: product.Id,
            Name: product.Name,
            Description: "Description mise à jour",
            Price: product.Price,
            Stock: product.Stock,
            CategoryId: product.CategoryId,
            Brand: brand,
            Model: model);

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_SetsBrandAndModel_PersistsThemTrimmed()
    {
        var product = await SeedProductAsync();

        await CreateHandler().Handle(
            BaseCommand(product, "  Abris Tempo  ", "  Tempo Duo 18x20  "),
            CancellationToken.None);

        var saved = await _db.Products.FindAsync(product.Id);
        saved.Should().NotBeNull();
        saved!.Brand.Should().Be("Abris Tempo");
        saved.Model.Should().Be("Tempo Duo 18x20");
    }

    [Fact]
    public async Task Handle_WithNullBrandAndModel_ClearsExistingValues()
    {
        var product = await SeedProductAsync(brand: "Abris Tempo", model: "Tempo Auto 11x16");

        await CreateHandler().Handle(
            BaseCommand(product, brand: null, model: null),
            CancellationToken.None);

        var saved = await _db.Products.FindAsync(product.Id);
        saved.Should().NotBeNull();
        saved!.Brand.Should().BeNull();
        saved.Model.Should().BeNull();
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    public void Dispose() => _db.Dispose();
}
