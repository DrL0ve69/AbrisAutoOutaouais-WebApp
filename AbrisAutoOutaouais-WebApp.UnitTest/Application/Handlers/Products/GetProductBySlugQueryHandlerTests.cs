using AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Products;

public sealed class GetProductBySlugQueryHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    private async Task<Product> SeedProductAsync(
        string slug = "abri-test",
        int? widthCm = null, int? lengthCm = null, int? heightCm = null)
    {
        var cat = ProductCategory.Create("Abris", "abris");
        var product = Product.Create(
            "Abri Test", slug, 150m, 3, cat.Id,
            widthCm: widthCm, lengthCm: lengthCm, heightCm: heightCm);
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
    public async Task Handle_WithDimensions_ProjectsThem()
    {
        await SeedProductAsync("abri-dimensionne", widthCm: 335, lengthCm: 488, heightCm: 244);
        var handler = new GetProductBySlugQueryHandler(_db);

        var result = await handler.Handle(
            new GetProductBySlugQuery("abri-dimensionne"), CancellationToken.None);

        result.WidthCm.Should().Be(335);
        result.LengthCm.Should().Be(488);
        result.HeightCm.Should().Be(244);
    }

    [Fact]
    public async Task Handle_WithoutDimensions_ProjectsNull()
    {
        await SeedProductAsync("abri-sans-dim");
        var handler = new GetProductBySlugQueryHandler(_db);

        var result = await handler.Handle(
            new GetProductBySlugQuery("abri-sans-dim"), CancellationToken.None);

        result.WidthCm.Should().BeNull();
        result.LengthCm.Should().BeNull();
        result.HeightCm.Should().BeNull();
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
