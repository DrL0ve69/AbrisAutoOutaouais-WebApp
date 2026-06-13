using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// Seeder du catalogue — crée les catégories et les produits inspirés de la gamme
/// Abris Tempo (https://www.abristempo.com/en) au premier démarrage si la table est vide.
/// Idempotent : ne fait rien si des produits existent déjà.
/// </summary>
public static class ProductSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("ProductSeeder");

        try
        {
            if (await db.Products.AnyAsync())
                return;

            // ── Catégories (basées sur la navigation « Shop » d'Abris Tempo) ──────
            var categories = new[]
            {
                ProductCategory.Create("Abris simples", "abris-simples"),
                ProductCategory.Create("Abris doubles", "abris-doubles"),
                ProductCategory.Create("Abris de rangement", "abris-rangement"),
                ProductCategory.Create("Abris d'entrée et de passage", "abris-entree-passage"),
                ProductCategory.Create("Abris industriels et commerciaux", "abris-industriels"),
                ProductCategory.Create("Toiles de remplacement", "toiles-remplacement"),
                ProductCategory.Create("Pièces et accessoires", "pieces-accessoires"),
            };
            var bySlug = categories.ToDictionary(c => c.Slug);
            await db.ProductCategories.AddRangeAsync(categories);

            // ── Produits ──────────────────────────────────────────────────────────
            var products = new List<Product>();

            // Dimensions hors-tout (largeur × longueur × hauteur, cm) renseignées pour les
            // abris ; null pour toiles / accessoires / petits formats (cf. plan D1).
            void Add(string name, string slug, decimal price, int stock, string categorySlug,
                     string description, decimal? rentalPrice, string image,
                     int? widthCm = null, int? lengthCm = null, int? heightCm = null)
            {
                var product = Product.Create(
                    name, slug, price, stock, bySlug[categorySlug].Id, description, rentalPrice,
                    widthCm, lengthCm, heightCm);
                product.AddImage(image, name);
                products.Add(product);
            }

            // Abris simples
            Add("Abri simple une voiture", "abri-simple-une-voiture", 349.00m, 25, "abris-simples",
                "Abri d'auto temporaire pour un véhicule. Structure d'acier galvanisé et toile Tempo résistante à l'hiver québécois.",
                39.00m, "/images/products/abri-simple-une-voiture.jpg", 335, 488, 244);
            Add("Abri à pente unique", "abri-pente-unique", 874.00m, 12, "abris-simples",
                "Abri à toit à pente unique, idéal contre les murs et les contraintes de dégagement.",
                79.00m, "/images/products/abri-pente-unique.jpg", 335, 610, 274);

            // Abris doubles
            Add("Abri double à pic", "abri-double-pic", 724.00m, 15, "abris-doubles",
                "Abri double à toit en pic pour deux véhicules. Excellente évacuation de la neige.",
                69.00m, "/images/products/abri-double-pic.jpg", 549, 610, 305);
            Add("Abri double rond", "abri-double-rond", 1099.00m, 10, "abris-doubles",
                "Abri double à toit arrondi, grande surface couverte et robustesse accrue.",
                99.00m, "/images/products/abri-double-rond.jpg", 610, 610, 305);

            // Abris de rangement
            Add("Abri de rangement / atelier", "abri-rangement-atelier", 899.00m, 8, "abris-rangement",
                "Abri polyvalent pour le rangement saisonnier, l'atelier ou la remise.",
                null, "/images/products/abri-rangement-atelier.jpg", 335, 488, 244);

            // Abris d'entrée et de passage (petits formats → dimensions non publiées)
            Add("Abri d'entrée", "abri-entree", 399.00m, 14, "abris-entree-passage",
                "Petit abri protégeant l'entrée principale contre la neige et la pluie.",
                null, "/images/products/abri-entree.jpg");
            Add("Abri de passage et clôture", "abri-passage-cloture", 324.00m, 18, "abris-entree-passage",
                "Abri tunnel pour passages, allées et sections de clôture.",
                null, "/images/products/abri-passage-cloture.jpg");

            // Abris industriels et commerciaux
            Add("Abri industriel et commercial", "abri-industriel-commercial", 2499.00m, 4, "abris-industriels",
                "Grand abri grand format pour usages commerciaux et industriels. Sur mesure disponible.",
                249.00m, "/images/products/abri-industriel-commercial.jpg", 610, 610, 305);

            // Toiles de remplacement (pièce souple → pas de dimensions hors-tout)
            Add("Toile de remplacement — abri simple", "toile-remplacement-simple", 149.00m, 40, "toiles-remplacement",
                "Toile de remplacement compatible avec les structures d'abris simples existantes.",
                null, "/images/products/toile-remplacement-simple.jpg");
            Add("Toile de remplacement — abri double", "toile-remplacement-double", 229.00m, 30, "toiles-remplacement",
                "Toile de remplacement compatible avec les structures d'abris doubles existantes.",
                null, "/images/products/toile-remplacement-double.jpg");

            // Pièces et accessoires (pas de dimensions hors-tout)
            Add("Kit d'ancrage au sol", "kit-ancrage-sol", 49.00m, 100, "pieces-accessoires",
                "Ensemble d'ancrages pour fixer solidement l'abri au sol.",
                null, "/images/products/kit-ancrage-sol.jpg");
            Add("Attaches et fixations (paquet)", "attaches-fixations", 19.00m, 200, "pieces-accessoires",
                "Paquet d'attaches et de fixations de rechange pour toiles Tempo.",
                null, "/images/products/attaches-fixations.jpg");

            await db.Products.AddRangeAsync(products);
            await db.SaveChangesAsync();

            logger.LogInformation(
                "Catalogue initialisé : {Categories} catégories et {Products} produits.",
                categories.Length, products.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Échec de l'initialisation du catalogue (ProductSeeder).");
            throw;
        }
    }
}
