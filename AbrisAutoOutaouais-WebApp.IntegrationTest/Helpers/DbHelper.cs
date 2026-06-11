using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.helpers;

public static class DbHelper
{
    /// <summary>Seed d'une catégorie + produit pour les tests qui en ont besoin.</summary>
    public static async Task<(Guid CategoryId, Guid ProductId)> SeedProductAsync(
        IServiceProvider sp,
        string name = "Abri Test",
        string slug = "abri-test",
        decimal price = 199.99m,
        int stock = 10)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = ProductCategory.Create("Abris", "abris");
        var product = Product.Create(name, slug, price, stock, category.Id);

        db.ProductCategories.Add(category);
        db.Products.Add(product);
        await db.SaveChangesAsync();

        return (category.Id, product.Id);
    }
}
