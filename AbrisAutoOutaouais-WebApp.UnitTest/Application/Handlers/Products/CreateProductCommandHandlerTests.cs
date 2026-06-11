using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services;
using System;
using System.Collections.Generic;
using System.Text;
using AbrisAutoOutaouais_WebApp.Application.Products.Commands;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Products;

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
            Description: "Un abri simple et efficace",
            Price: 299.99m,
            StockQuantity: 10,
            CategoryId: categoryId);

        var handler = CreateHandler();
        var id = await handler.Handle(cmd, CancellationToken.None);

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
