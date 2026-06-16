using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// Seeder du catalogue — crée les catégories et les produits inspirés de la gamme
/// Abris Tempo (https://www.abristempo.com/en) au premier démarrage si la table est vide.
///
/// Idempotent à DEUX niveaux :
///  1. Premier démarrage (table vide) → crée catégories + produits.
///  2. Table déjà peuplée → BACKFILL (G3) : les dimensions hors-tout et la marque/modèle ont
///     été ajoutées APRÈS le premier seed (D1 puis G1) ; un dev DB déjà semé portait donc des
///     produits aux <c>WidthCm</c>/<c>Brand</c> NULL, ce qui faisait retourner « suggest-shelters »
///     systématiquement vide (la proposition d'abris ne fonctionnait pas). Le backfill renseigne
///     ces champs, par SLUG (donc seulement le catalogue connu — jamais un produit créé/édité par
///     un admin), et UNIQUEMENT quand ils sont absents (n'écrase pas une valeur déjà saisie).
/// </summary>
public static class ProductSeeder
{
    /// <summary>Gabarit canonique d'un abri du catalogue (dimensions + marque/modèle), clé du backfill.</summary>
    private sealed record ShelterSpec(
        string Slug, int WidthCm, int LengthCm, int HeightCm, string Brand, string Model);

    /// <summary>
    /// Dimensions/marque/modèle canoniques des abris réels (les toiles/accessoires/petits formats
    /// n'en ont pas). Référence du BACKFILL d'un DB déjà peuplé. Le premier seed (table vide) pose
    /// les mêmes valeurs via les appels <c>Add(...)</c> ci-dessous — garder les deux en phase.
    /// </summary>
    private static readonly IReadOnlyList<ShelterSpec> ShelterSpecs =
    [
        new("abri-simple-une-voiture", 335, 488, 244, "Abris Tempo", "Tempo Auto 11x16"),
        new("abri-pente-unique", 335, 610, 274, "Abris Tempo", "Tempo Mono-Pente 11x20"),
        new("abri-double-pic", 549, 610, 305, "Abris Tempo", "Tempo Duo 18x20"),
        new("abri-double-rond", 610, 610, 305, "Abris Tempo", "Tempo Duo Rond 20x20"),
        new("abri-rangement-atelier", 335, 488, 244, "Abris Tempo", "Tempo Storage 11x16"),
        new("abri-industriel-commercial", 610, 610, 305, "Abris Tempo", "Tempo Industriel 20x20"),
    ];

    /// <summary>Marque/modèle des petits abris (dimensions hors-tout non publiées).</summary>
    private static readonly IReadOnlyDictionary<string, (string Brand, string Model)> SmallShelterBrands =
        new Dictionary<string, (string, string)>
        {
            ["abri-entree"] = ("Abris Tempo", "Tempo Entrée"),
            ["abri-passage-cloture"] = ("Abris Tempo", "Tempo Passage"),
        };

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
            {
                // Table déjà peuplée : on ne recrée rien, mais on REMPLIT les dimensions/marque/modèle
                // manquantes des abris connus (G3 — répare un DB semé avant D1/G1). Idempotent.
                await BackfillShelterDataAsync(db, logger);
                return;
            }

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
            // Marque/modèle (brand/model) renseignés pour les abris réels (marque « Abris Tempo »
            // + modèle de gamme) ; null pour toiles / accessoires / pièces souples.
            void Add(string name, string slug, decimal price, int stock, string categorySlug,
                     string description, decimal? rentalPrice, string image,
                     int? widthCm = null, int? lengthCm = null, int? heightCm = null,
                     string? brand = null, string? model = null)
            {
                var product = Product.Create(
                    name, slug, price, stock, bySlug[categorySlug].Id, description, rentalPrice,
                    widthCm, lengthCm, heightCm, brand, model);
                product.AddImage(image, name);
                products.Add(product);
            }

            // Abris simples
            Add("Abri simple une voiture", "abri-simple-une-voiture", 349.00m, 25, "abris-simples",
                "Abri d'auto temporaire pour un véhicule. Structure d'acier galvanisé et toile Tempo résistante à l'hiver québécois.",
                39.00m, "/images/products/abri-simple-une-voiture.jpg", 335, 488, 244,
                "Abris Tempo", "Tempo Auto 11x16");
            Add("Abri à pente unique", "abri-pente-unique", 874.00m, 12, "abris-simples",
                "Abri à toit à pente unique, idéal contre les murs et les contraintes de dégagement.",
                79.00m, "/images/products/abri-pente-unique.jpg", 335, 610, 274,
                "Abris Tempo", "Tempo Mono-Pente 11x20");

            // Abris doubles
            Add("Abri double à pic", "abri-double-pic", 724.00m, 15, "abris-doubles",
                "Abri double à toit en pic pour deux véhicules. Excellente évacuation de la neige.",
                69.00m, "/images/products/abri-double-pic.jpg", 549, 610, 305,
                "Abris Tempo", "Tempo Duo 18x20");
            Add("Abri double rond", "abri-double-rond", 1099.00m, 10, "abris-doubles",
                "Abri double à toit arrondi, grande surface couverte et robustesse accrue.",
                99.00m, "/images/products/abri-double-rond.jpg", 610, 610, 305,
                "Abris Tempo", "Tempo Duo Rond 20x20");

            // Abris de rangement
            Add("Abri de rangement / atelier", "abri-rangement-atelier", 899.00m, 8, "abris-rangement",
                "Abri polyvalent pour le rangement saisonnier, l'atelier ou la remise.",
                null, "/images/products/abri-rangement-atelier.jpg", 335, 488, 244,
                "Abris Tempo", "Tempo Storage 11x16");

            // Abris d'entrée et de passage (petits formats → dimensions non publiées)
            Add("Abri d'entrée", "abri-entree", 399.00m, 14, "abris-entree-passage",
                "Petit abri protégeant l'entrée principale contre la neige et la pluie.",
                null, "/images/products/abri-entree.jpg",
                brand: "Abris Tempo", model: "Tempo Entrée");
            Add("Abri de passage et clôture", "abri-passage-cloture", 324.00m, 18, "abris-entree-passage",
                "Abri tunnel pour passages, allées et sections de clôture.",
                null, "/images/products/abri-passage-cloture.jpg",
                brand: "Abris Tempo", model: "Tempo Passage");

            // Abris industriels et commerciaux
            Add("Abri industriel et commercial", "abri-industriel-commercial", 2499.00m, 4, "abris-industriels",
                "Grand abri grand format pour usages commerciaux et industriels. Sur mesure disponible.",
                249.00m, "/images/products/abri-industriel-commercial.jpg", 610, 610, 305,
                "Abris Tempo", "Tempo Industriel 20x20");

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

    /// <summary>
    /// Renseigne dimensions/marque/modèle des abris connus (par slug) restés NULL sur un DB déjà
    /// semé avant que ces champs n'existent (D1/G1). Ne touche QUE les valeurs absentes — n'écrase
    /// jamais une donnée saisie par un admin. Idempotent : un 2e passage ne change rien.
    /// </summary>
    // internal (et non private) pour permettre un test de non-régression direct (L-005) : le
    // backfill répare « suggest-shelters vide » et doit donc être gardé par CI. Cf.
    // ProductSeederBackfillTests. InternalsVisibleTo est déjà posé sur le projet UnitTest.
    internal static async Task BackfillShelterDataAsync(ApplicationDbContext db, ILogger logger)
    {
        var slugs = ShelterSpecs.Select(s => s.Slug)
            .Concat(SmallShelterBrands.Keys)
            .ToHashSet();

        // Tracking (pas d'AsNoTracking) : on modifie puis on persiste.
        var products = await db.Products
            .Where(p => slugs.Contains(p.Slug))
            .ToListAsync();

        var specsBySlug = ShelterSpecs.ToDictionary(s => s.Slug);
        var updated = 0;

        foreach (var product in products)
        {
            var changed = false;

            // Abris à dimensions publiées : compléter dims + marque/modèle CHAMP PAR CHAMP. On ne
            // renseigne QUE les champs individuellement absents — un admin ayant saisi une largeur
            // sans longueur (ou seulement la marque) garde sa valeur (n'écrase jamais une donnée
            // saisie). `SetDimensions`/`SetBrandModel` écrivant les membres en bloc, on reconstruit
            // l'appel avec la valeur existante pour les champs déjà renseignés.
            if (specsBySlug.TryGetValue(product.Slug, out var spec))
            {
                if (product.WidthCm is null || product.LengthCm is null || product.HeightCm is null)
                {
                    product.SetDimensions(
                        product.WidthCm ?? spec.WidthCm,
                        product.LengthCm ?? spec.LengthCm,
                        product.HeightCm ?? spec.HeightCm);
                    changed = true;
                }
                if (FillBrandModel(product, spec.Brand, spec.Model)) changed = true;
            }
            // Petits abris (sans dimensions) : compléter seulement marque/modèle (par champ).
            else if (SmallShelterBrands.TryGetValue(product.Slug, out var smallBrand)
                     && FillBrandModel(product, smallBrand.Brand, smallBrand.Model))
            {
                changed = true;
            }

            if (changed) updated++;
        }

        if (updated > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation(
                "Backfill catalogue (G3) : dimensions/marque/modèle complétés sur {Count} abri(s).",
                updated);
        }
    }

    /// <summary>
    /// Renseigne marque/modèle CHAMP PAR CHAMP : ne remplit que celui qui est vide, en préservant
    /// l'autre s'il a été saisi. Retourne vrai si au moins un champ a été modifié.
    /// </summary>
    private static bool FillBrandModel(Product product, string brand, string model)
    {
        var brandMissing = string.IsNullOrWhiteSpace(product.Brand);
        var modelMissing = string.IsNullOrWhiteSpace(product.Model);
        if (!brandMissing && !modelMissing) return false;

        product.SetBrandModel(
            brandMissing ? brand : product.Brand,
            modelMissing ? model : product.Model);
        return true;
    }
}
