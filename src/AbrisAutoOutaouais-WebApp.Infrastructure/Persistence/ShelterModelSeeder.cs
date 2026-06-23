using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// Seeder du RÉFÉRENTIEL des modèles d'abris paramétriques (EPIC 9) + de leur GRILLE DE PRIX EXACTE
/// (chantier « grille de prix exacte »). Le prix dépend désormais de (modèle × longueur × hauteur
/// dégagée) : chaque modèle porte une grille (<see cref="ShelterModel.PriceEntries"/>) qui peut être
/// ÉPARSE. Les données proviennent de la ressource EMBARQUÉE <c>shelter-price-grids.json</c> (lue par
/// <see cref="Assembly.GetManifestResourceStream"/> — aucun fichier externe au runtime).
///
/// Idempotent + BACKFILL PAR SLUG (L-031) : un modèle de référence ABSENT est créé (dimensions +
/// grille) ; un modèle DÉJÀ présent n'est jamais réécrit dans ses champs admin, MAIS si sa grille de
/// prix est VIDE (cas typique d'une base semée avant l'introduction de la grille), on la backfille
/// par slug sans toucher aux éditions admin (idem dimensions manquantes). Les anciens slugs
/// multi-largeurs (<see cref="LegacyMultiWidthSlugs"/>) sont soft-deletés au passage (rework EPIC 9 :
/// une largeur = un modèle). Un 2e passage ne change rien (aucun <c>SaveChanges</c> si rien n'a
/// changé). Toute requête EF ici doit être TRADUISIBLE PAR LE PROVIDER RELATIONNEL (SQL Server), pas
/// seulement « acceptée par InMemory » (L-035/L-001) ; le <c>.Contains</c> sur <c>string[]</c> est OK.
/// </summary>
public static class ShelterModelSeeder
{
    /// <summary>Nom logique de la ressource embarquée (cf. csproj <c>LogicalName</c>).</summary>
    private const string PriceGridResourceName = "shelter-price-grids.json";

    /// <summary>
    /// Gabarit canonique d'un modèle de référence chargé depuis le JSON embarqué. Clé du backfill :
    /// le <see cref="Slug"/>. <see cref="CategorySlug"/> rattache le modèle à une catégorie produit
    /// DÉJÀ semée (cf. <c>ProductSeeder</c>) ; absente → modèle ignoré (log d'avertissement).
    /// Une largeur = un modèle (rework EPIC 9) → <see cref="WidthCm"/> scalaire. Les prix sont en
    /// CENTS, triplets [longueur, hauteur, prix].
    /// </summary>
    private sealed record ShelterModelSpec(
        [property: JsonPropertyName("slug")] string Slug,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("categorySlug")] string CategorySlug,
        [property: JsonPropertyName("widthCm")] int WidthCm,
        [property: JsonPropertyName("minLengthCm")] int MinLengthCm,
        [property: JsonPropertyName("lengthStepCm")] int LengthStepCm,
        [property: JsonPropertyName("maxLengthCm")] int MaxLengthCm,
        [property: JsonPropertyName("clearHeightsCm")] IReadOnlyList<int> ClearHeightsCm,
        [property: JsonPropertyName("prices")] IReadOnlyList<IReadOnlyList<int>> Prices)
    {
        /// <summary>Convertit les triplets [longueur, hauteur, prix] en entrées de grille de domaine.</summary>
        public IReadOnlyList<ShelterModel.PriceEntryInput> ToPriceEntries() =>
            Prices
                .Select(p => new ShelterModel.PriceEntryInput(p[0], p[1], p[2]))
                .ToList();
    }

    /// <summary>
    /// Référentiel validé, chargé une seule fois depuis le JSON embarqué (lazy + thread-safe via
    /// <see cref="Lazy{T}"/>). RÈGLE : une largeur = un modèle distinct.
    /// </summary>
    private static readonly Lazy<IReadOnlyList<ShelterModelSpec>> SpecsLazy = new(LoadSpecs);

    private static IReadOnlyList<ShelterModelSpec> Specs => SpecsLazy.Value;

    private static IReadOnlyList<ShelterModelSpec> LoadSpecs()
    {
        var assembly = typeof(ShelterModelSeeder).Assembly;
        using var stream = assembly.GetManifestResourceStream(PriceGridResourceName)
            ?? throw new InvalidOperationException(
                $"Ressource embarquée « {PriceGridResourceName} » introuvable (vérifier l'EmbeddedResource du csproj).");

        var specs = JsonSerializer.Deserialize<List<ShelterModelSpec>>(stream)
            ?? throw new InvalidOperationException(
                $"Désérialisation de « {PriceGridResourceName} » impossible (JSON nul).");

        return specs;
    }

    /// <summary>
    /// Anciens slugs MULTI-LARGEURS remplacés par les modèles par-largeur. Soft-deletés (idempotemment)
    /// au seed pour ne plus apparaître au catalogue. <c>monopente</c> est CONSERVÉ (une seule largeur).
    /// TYPE = <c>string[]</c> (PAS <c>HashSet</c>/<c>IReadOnlySet</c>) : EF traduit
    /// <c>tableau.Contains(colonne)</c> en <c>IN (...)</c> SQL, mais NE traduit PAS
    /// <c>IReadOnlySet&lt;T&gt;.Contains</c> (L-038/L-035/L-001). Le critère est « traduisible par le
    /// provider relationnel », pas « accepté par InMemory ».
    /// </summary>
    private static readonly string[] LegacyMultiWidthSlugs = ["simple", "double-pointu", "double-rond"];

    /// <summary>
    /// MIGRATIONS RÉFÉRENTIELLES UNIQUES de catégorie (par slug de modèle) : <c>oldCategorySlug</c> →
    /// <c>newCategorySlug</c>. Un modèle hérité encore rattaché à son ANCIENNE catégorie est rerattaché
    /// une seule fois à la nouvelle. La garde « catégorie courante == ancienne » est ESSENTIELLE :
    /// elle évite d'écraser un déplacement VOLONTAIRE fait par un admin (via
    /// <c>UpdateShelterModelCommand</c> → <c>Reconfigure(categoryId)</c>) — sinon le seed annulerait
    /// l'édition admin à chaque démarrage (L-031/L-046 : ne jamais écraser une édition admin). Idempotent :
    /// après migration <c>CategoryId</c> == nouvelle, la garde ne re-déclenche plus.
    ///
    /// Parité abristempo : <c>monopente</c> (pente unique) quitte « abris-simples » pour sa propre
    /// catégorie « abris-monopente ».
    /// </summary>
    private static readonly IReadOnlyDictionary<string, (string OldCategorySlug, string NewCategorySlug)>
        CategoryMigrations = new Dictionary<string, (string, string)>
        {
            ["monopente"] = ("abris-simples", "abris-monopente"),
        };

    /// <summary>
    /// Vue de test (L-005) sur les invariants dimensionnels de chaque spec : permet d'asserter
    /// <c>(Max - Min) % Step == 0</c>, « une largeur par modèle » et « grille non vide » SANS exposer
    /// le record privé. <c>internal</c> car le projet UnitTest a <c>InternalsVisibleTo</c>.
    /// </summary>
    internal sealed record SpecInvariant(
        string Slug, int LengthStepCm, int MinLengthCm, int MaxLengthCm,
        int WidthCount, int ClearHeightCount, int LengthCount, int PriceEntryCount, int MinPriceCents);

    /// <summary>Invariants dimensionnels des specs semées (pour le test-garde).</summary>
    internal static IReadOnlyList<SpecInvariant> SpecInvariants =>
        Specs
            .Select(s => new SpecInvariant(
                s.Slug, s.LengthStepCm, s.MinLengthCm, s.MaxLengthCm,
                WidthCount: 1,
                ClearHeightCount: s.ClearHeightsCm.Count,
                LengthCount: (s.MaxLengthCm - s.MinLengthCm) / s.LengthStepCm + 1,
                PriceEntryCount: s.Prices.Count,
                MinPriceCents: s.Prices.Count == 0 ? 0 : s.Prices.Min(p => p[2])))
            .ToList();

    /// <summary>Slugs des modèles par-largeur semés (pour les tests).</summary>
    internal static IReadOnlyList<string> SeededSlugs =>
        Specs.Select(s => s.Slug).ToList();

    /// <summary>Anciens slugs multi-largeurs retirés au seed (pour les tests).</summary>
    internal static IReadOnlyCollection<string> LegacySlugs => LegacyMultiWidthSlugs;

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("ShelterModelSeeder");

        try
        {
            await SeedAsync(db, logger);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Échec de l'initialisation du référentiel des modèles d'abris (ShelterModelSeeder).");
            throw;
        }
    }

    /// <summary>
    /// Cœur idempotent du seed. Soft-delete les anciens modèles multi-largeurs encore actifs (rework
    /// EPIC 9) ; crée par SLUG les modèles par-largeur absents (dimensions + grille) ; backfille la
    /// grille (et les dimensions) d'un modèle existant dont la grille est VIDE sans écraser une
    /// édition admin (L-031) ; <c>SaveChanges</c> unique, seulement si quelque chose a changé.
    /// </summary>
    // internal (et non private) pour permettre un test de non-régression direct (L-005) ; le projet
    // UnitTest a déjà InternalsVisibleTo. Cf. ShelterModelSeederBackfillTests.
    internal static async Task SeedAsync(ApplicationDbContext db, ILogger logger)
    {
        // Catégories existantes (par slug) — semées par ProductSeeder. On rattache à l'existant.
        // GroupBy + First (et NON ToDictionaryAsync) : tolérant à d'éventuels slugs en double dans
        // le store partagé InMemory (L-010) ; on prend la 1re catégorie par slug (déterministe par Id).
        var categories = await db.ProductCategories
            .Select(c => new { c.Slug, c.Id })
            .ToListAsync();
        var categoriesBySlug = categories
            .GroupBy(c => c.Slug)
            .ToDictionary(g => g.Key, g => g.OrderBy(c => c.Id).First().Id);

        // Modèles déjà présents (y compris soft-deleted : .IgnoreQueryFilters()), avec leur grille et
        // leurs dimensions chargées (entités RÉGULIÈRES → Include explicite, L-035) pour le backfill.
        var existingModels = await db.ShelterModels
            .IgnoreQueryFilters()
            .Include(m => m.PriceEntries)
            .Include(m => m.Dimensions)
            .ToListAsync();
        var existingBySlug = existingModels
            .GroupBy(m => m.Slug)
            .ToDictionary(g => g.Key, g => g.OrderBy(m => m.Id).First());

        var changed = false;

        // ── Retrait des anciens modèles multi-largeurs (idempotent) ──────────────────────────────
        // SOFT-DELETE via .Remove() (le SoftDeleteInterceptor le convertit en IsDeleted=true → état
        // Modified, aucune opération relationnelle → sûr sur InMemory, L-022/L-035). On ne re-supprime
        // QUE ceux encore actifs (idempotence : 2e passage = aucun changement).
        var legacyModels = existingModels
            .Where(m => LegacyMultiWidthSlugs.Contains(m.Slug) && !m.IsDeleted)
            .ToList();

        if (legacyModels.Count > 0)
        {
            db.ShelterModels.RemoveRange(legacyModels);
            changed = true;
            logger.LogInformation(
                "Référentiel des modèles d'abris : {Count} ancien(s) modèle(s) multi-largeurs retiré(s).",
                legacyModels.Count);
        }

        var added = 0;
        var backfilled = 0;
        var recategorized = 0;

        foreach (var spec in Specs)
        {
            if (existingBySlug.TryGetValue(spec.Slug, out var existing))
            {
                // Modèle déjà présent → jamais écrasé dans ses champs admin. On backfille UNIQUEMENT
                // sa grille de prix si elle est vide (base semée avant l'introduction de la grille).
                // Le parent est SUIVI : on ajoute les nouvelles entrées explicitement au DbSet pour
                // qu'EF (y compris InMemory, L-035) les marque « Added » plutôt que de tenter de
                // réconcilier une collection enfant d'un agrégat déjà suivi (DbUpdateConcurrencyException).
                if (existing.PriceEntries.Count == 0 && spec.Prices.Count > 0)
                {
                    existing.SetPriceGrid(spec.ToPriceEntries());
                    db.Set<ShelterPriceEntry>().AddRange(existing.PriceEntries.ToList());
                    backfilled++;
                    changed = true;
                }

                // MIGRATION RÉFÉRENTIELLE UNIQUE (gardée) : un modèle hérité ENCORE rattaché à son
                // ANCIENNE catégorie est rerattaché à la nouvelle (ex. « monopente » : abris-simples
                // → abris-monopente). La garde « catégorie courante == ancienne » est essentielle :
                // un modèle déjà migré, OU déplacé volontairement ailleurs par un admin (via
                // UpdateShelterModelCommand → Reconfigure), n'est JAMAIS touché (L-031/L-046). Idempotent :
                // après migration CategoryId == nouvelle, la garde ne re-déclenche plus.
                if (CategoryMigrations.TryGetValue(spec.Slug, out var migration)
                    && categoriesBySlug.TryGetValue(migration.OldCategorySlug, out var oldCategoryId)
                    && categoriesBySlug.TryGetValue(migration.NewCategorySlug, out var newCategoryId)
                    && existing.CategoryId == oldCategoryId)
                {
                    existing.Recategorize(newCategoryId);
                    recategorized++;
                    changed = true;
                }

                continue;
            }

            if (!categoriesBySlug.TryGetValue(spec.CategorySlug, out var categoryId))
            {
                logger.LogWarning(
                    "Catégorie « {CategorySlug} » introuvable : modèle d'abri « {Slug} » non semé.",
                    spec.CategorySlug, spec.Slug);
                continue;
            }

            var model = ShelterModel.Create(
                spec.Slug, spec.Name, categoryId,
                spec.LengthStepCm, spec.MinLengthCm, spec.MaxLengthCm,
                widthsCm: [spec.WidthCm],
                clearHeightsCm: spec.ClearHeightsCm,
                priceEntries: spec.ToPriceEntries());

            await db.ShelterModels.AddAsync(model);
            added++;
        }

        if (added > 0)
        {
            changed = true;
            logger.LogInformation(
                "Référentiel des modèles d'abris : {Count} modèle(s) ajouté(s).", added);
        }

        if (backfilled > 0)
            logger.LogInformation(
                "Référentiel des modèles d'abris : grille de prix backfillée pour {Count} modèle(s) existant(s).",
                backfilled);

        if (recategorized > 0)
            logger.LogInformation(
                "Référentiel des modèles d'abris : {Count} modèle(s) recatégorisé(s).", recategorized);

        // Un seul SaveChanges pour le retrait des anciens slugs, l'ajout des nouveaux ET le backfill.
        if (changed)
            await db.SaveChangesAsync();
    }
}
