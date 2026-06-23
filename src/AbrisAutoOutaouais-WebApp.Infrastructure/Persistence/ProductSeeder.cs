using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// Seeder du catalogue — crée les catégories et les produits FIXES restants (toiles de remplacement
/// et pièces/accessoires) au premier démarrage si la table est vide, et garantit à CHAQUE démarrage
/// le référentiel des catégories ainsi que le RETRAIT des anciens abris fixes.
///
/// Les ABRIS ne sont plus des <see cref="Product"/> fixes : ils sont devenus des
/// <see cref="ShelterModel"/> PARAMÉTRIQUES (EPIC 9, semés par <c>ShelterModelSeeder</c>). Les 8 abris
/// fixes historiques sont donc soft-deletés idempotemment à chaque démarrage par
/// <see cref="RemoveLegacyShelterProductsAsync"/> (un DB dev/prod déjà semé se nettoie tout seul). Les
/// <c>RentalContract</c> historiques conservent leur <c>ProductName</c> en snapshot et leur
/// <c>ProductId</c> est nullable — le soft-delete ne casse donc aucune FK.
///
/// Idempotent à plusieurs niveaux :
///  1. Catégories (<see cref="EnsureCategoriesAsync"/>) : upsert par slug à chaque démarrage.
///  2. Retrait des abris fixes (<see cref="RemoveLegacyShelterProductsAsync"/>) : à chaque démarrage.
///  3. Produits restants : créés seulement au tout premier seed (table vide).
/// </summary>
public static class ProductSeeder
{
    /// <summary>
    /// RÉFÉRENTIEL CANONIQUE des catégories produit (nom + slug), source unique de vérité. Le premier
    /// seed (table vide) ET l'<see cref="EnsureCategoriesAsync"/> idempotent s'appuient TOUS DEUX
    /// dessus — garder les deux chemins en phase. Le slug est la clé d'upsert (jamais dupliqué).
    /// « abris-monopente » est sa PROPRE catégorie (parité abristempo : la pente unique n'est plus
    /// rangée sous « abris-simples »).
    /// </summary>
    private static readonly IReadOnlyList<(string Name, string Slug)> CategorySpecs =
    [
        ("Abris simples", "abris-simples"),
        ("Abris monopente", "abris-monopente"),
        ("Abris doubles", "abris-doubles"),
        ("Abris de rangement", "abris-rangement"),
        ("Abris d'entrée et de passage", "abris-entree-passage"),
        ("Abris industriels et commerciaux", "abris-industriels"),
        ("Toiles de remplacement", "toiles-remplacement"),
        ("Pièces et accessoires", "pieces-accessoires"),
    ];

    /// <summary>
    /// Slugs des 8 anciens ABRIS FIXES, désormais remplacés par des <see cref="ShelterModel"/>
    /// paramétriques. Soft-deletés idempotemment à chaque démarrage (cf.
    /// <see cref="RemoveLegacyShelterProductsAsync"/>). TYPE = <c>string[]</c> (PAS
    /// <c>HashSet</c>/<c>IReadOnlySet</c>) : EF traduit <c>tableau.Contains(colonne)</c> en
    /// <c>IN (...)</c> SQL, mais NE traduit PAS <c>IReadOnlySet&lt;T&gt;.Contains</c> (L-038/L-035/L-001).
    /// </summary>
    private static readonly string[] LegacyShelterProductSlugs =
    [
        "abri-simple-une-voiture",
        "abri-pente-unique",
        "abri-double-pic",
        "abri-double-rond",
        "abri-rangement-atelier",
        "abri-industriel-commercial",
        "abri-entree",
        "abri-passage-cloture",
    ];

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("ProductSeeder");

        try
        {
            // ── Catégories : upsert idempotent AVANT tout le reste ────────────────
            // Les catégories ne se créaient qu'au tout premier seed (table Products vide) : un dev DB
            // déjà semé ne recevait JAMAIS une catégorie ajoutée plus tard (ex. « abris-monopente »).
            // On garantit donc la présence de TOUTES les catégories du référentiel à CHAQUE démarrage,
            // avant le test « table peuplée ? » (sinon ShelterModelSeeder, qui tourne ensuite, ignore
            // les modèles d'une catégorie absente).
            await EnsureCategoriesAsync(db, logger);

            // ── Retrait des anciens abris fixes : à CHAQUE démarrage, hors du garde « table vide » ──
            // Les abris sont devenus des ShelterModel paramétriques ; les 8 Product abris historiques
            // doivent disparaître du catalogue. On le fait sur TOUT démarrage (pas seulement au premier
            // seed) pour qu'un DB dev/prod déjà peuplé soit nettoyé. Idempotent (L-031).
            await RemoveLegacyShelterProductsAsync(db, logger);

            if (await db.Products.AnyAsync())
            {
                // Table déjà peuplée : rien d'autre à créer (catégories upsertées + abris retirés
                // ci-dessus). On s'arrête là.
                return;
            }

            // ── Catégories (déjà upsertées ci-dessus) : on les recharge par slug ───
            // EnsureCategoriesAsync vient de garantir leur présence ; on lit l'existant pour rattacher
            // les produits (jamais de double-création — la table peut déjà les contenir).
            var bySlug = await db.ProductCategories
                .ToDictionaryAsync(c => c.Slug);

            // ── Produits FIXES restants (toiles + pièces/accessoires) ──────────────
            // Les ABRIS ne sont plus ici : ce sont des ShelterModel paramétriques (EPIC 9). Seuls
            // restent les articles fixes au catalogue (toiles de remplacement, kits, attaches).
            var products = new List<Product>();

            void Add(string name, string slug, decimal price, int stock, string categorySlug,
                     string description, decimal? rentalPrice, string image)
            {
                var product = Product.Create(
                    name, slug, price, stock, bySlug[categorySlug].Id, description, rentalPrice);
                product.AddImage(image, name);
                products.Add(product);
            }

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
                bySlug.Count, products.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Échec de l'initialisation du catalogue (ProductSeeder).");
            throw;
        }
    }

    /// <summary>
    /// UPSERT IDEMPOTENT des catégories du référentiel (<see cref="CategorySpecs"/>) par SLUG, à
    /// CHAQUE démarrage : ajoute toute catégorie manquante, ne duplique jamais, ne supprime rien.
    /// Indispensable car la création de catégories du chemin « table vide » ne s'exécute qu'au tout
    /// premier seed — un dev DB déjà semé ne recevrait sinon jamais une catégorie ajoutée plus tard
    /// (ex. « abris-monopente »), et <c>ShelterModelSeeder</c> (qui tourne après) ignorerait les
    /// modèles d'une catégorie absente. <c>SaveChanges</c> unique, seulement si quelque chose manque.
    /// </summary>
    // internal (et non private) pour un test de non-régression direct (L-005/L-031) : l'ajout de
    // « abris-monopente » sur un DB existant DOIT être couvert par CI. InternalsVisibleTo est posé.
    internal static async Task EnsureCategoriesAsync(ApplicationDbContext db, ILogger logger)
    {
        var existingSlugs = await db.ProductCategories
            .Select(c => c.Slug)
            .ToListAsync();
        var existingSet = existingSlugs.ToHashSet();

        var added = 0;
        foreach (var (name, slug) in CategorySpecs)
        {
            if (existingSet.Contains(slug)) continue;
            await db.ProductCategories.AddAsync(ProductCategory.Create(name, slug));
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation(
                "Catégories produit : {Count} catégorie(s) manquante(s) ajoutée(s).", added);
        }
    }

    /// <summary>
    /// Retire (SOFT-DELETE) les 8 anciens ABRIS FIXES (<see cref="LegacyShelterProductSlugs"/>) restés
    /// au catalogue après leur remplacement par des <see cref="ShelterModel"/> paramétriques (EPIC 9).
    /// Idempotent (L-031) : ne touche QUE les lignes encore ACTIVES (le filtre de requête soft-delete
    /// exclut déjà les déjà-supprimés) ; un 2e passage ne trouve plus rien et ne réécrit rien.
    /// <c>SaveChanges</c> unique, seulement si au moins un abri a été retiré.
    ///
    /// Le <c>.Remove()</c> est converti en <c>IsDeleted = true</c> par le
    /// <c>SoftDeleteInterceptor</c> (état Modified, aucune opération relationnelle de suppression →
    /// sûr sur InMemory comme sur SQL Server). Les <c>RentalContract</c> historiques gardent leur
    /// <c>ProductName</c> en snapshot et leur <c>ProductId</c> nullable, donc aucune FK n'est cassée.
    /// </summary>
    // internal (et non private) pour un test de non-régression direct (L-005/L-031) : ce nettoyage
    // d'un DB déjà semé DOIT être couvert par CI. InternalsVisibleTo est posé sur le projet UnitTest.
    internal static async Task RemoveLegacyShelterProductsAsync(ApplicationDbContext db, ILogger logger)
    {
        // Le filtre de requête global (!IsDeleted) ne ramène que les abris encore ACTIFS → idempotent
        // sans garde supplémentaire. `.Contains` sur un `string[]` se traduit en `IN (...)` SQL (L-038).
        var legacy = await db.Products
            .Where(p => LegacyShelterProductSlugs.Contains(p.Slug))
            .ToListAsync();

        if (legacy.Count == 0) return;

        db.Products.RemoveRange(legacy);  // SoftDeleteInterceptor → IsDeleted = true
        await db.SaveChangesAsync();

        logger.LogInformation(
            "Catalogue : {Count} ancien(s) abri(s) fixe(s) retiré(s) (remplacés par des modèles paramétriques).",
            legacy.Count);
    }
}
