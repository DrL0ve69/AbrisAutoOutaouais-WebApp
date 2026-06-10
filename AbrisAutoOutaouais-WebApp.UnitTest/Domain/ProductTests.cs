using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

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
