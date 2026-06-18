using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

/// <summary>
/// Seeder du RÉFÉRENTIEL des modèles d'abris paramétriques (EPIC 9). Configurable par dimensions :
/// chaque modèle expose des largeurs/hauteurs et une longueur continue par pas (cf.
/// <see cref="ShelterModel"/>). Données validées (1 pi = 30,48 cm, 1 po = 2,54 cm).
///
/// Idempotent + BACKFILL PAR SLUG (L-031) : un modèle de référence est créé seulement si son slug
/// est ABSENT ; un modèle déjà présent n'est JAMAIS écrasé (un admin a pu l'éditer). Un 2e passage
/// ne change donc rien (aucun <c>SaveChanges</c> si rien n'a été ajouté). N'utilise que des
/// opérations EF compatibles InMemory — pas de SQL brut (les tests d'intégration bootent sur
/// InMemory, L-022).
/// </summary>
public static class ShelterModelSeeder
{
    /// <summary>
    /// Gabarit canonique d'un modèle de référence. Clé du backfill : le <see cref="Slug"/>.
    /// <see cref="CategorySlug"/> rattache le modèle à une catégorie produit DÉJÀ semée
    /// (cf. <c>ProductSeeder</c>) ; si elle est absente, le modèle est ignoré (log d'avertissement).
    /// </summary>
    private sealed record ShelterModelSpec(
        string Slug,
        string Name,
        string CategorySlug,
        int LengthStepCm,
        int MinLengthCm,
        int MaxLengthCm,
        decimal BasePrice,
        int PricePerArchCents,
        IReadOnlyList<int> WidthsCm,
        IReadOnlyList<int> ClearHeightsCm);

    /// <summary>
    /// Référentiel validé (EPIC 9.1). Largeurs/hauteurs en cm ; longueurs par pas entre min et max.
    /// Catégories rattachées à celles semées par <c>ProductSeeder</c> (abris simples / doubles).
    ///
    /// NOTE (écart vs table du plan) : les longueurs sont des conversions de PIEDS (4 pi = 122 cm,
    /// 5 pi = 152 cm). L'invariant de domaine exige <c>(Max - Min) % Step == 0</c> (la longueur max
    /// doit être atteignable par pas depuis la base). Comme min et max du plan étaient arrondis
    /// INDÉPENDAMMENT (ex. 122 et 1829 → 1707/122 = 13,99, non aligné), on dérive ici la longueur
    /// max comme <c>Min + N × Step</c> où N = nombre de pas impliqué par la table en pieds : simple/
    /// monopente 4→60 pi = 14 pas → 1830 cm ; double-pointu 4→44 pi = 10 pas → 1342 cm ; double-rond
    /// 15→35 pi = 4 pas → 1065 cm. L'écart au cm près est sans incidence métier (le pas reste exact).
    /// </summary>
    private static readonly IReadOnlyList<ShelterModelSpec> Specs =
    [
        new("simple", "Abri simple — Abris Tempo", "abris-simples",
            LengthStepCm: 122, MinLengthCm: 122, MaxLengthCm: 1830,  // 4→60 pi : 14 pas
            BasePrice: 349.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [335, 366], ClearHeightsCm: [198]),

        new("monopente", "Abri monopente — Abris Tempo", "abris-simples",
            LengthStepCm: 122, MinLengthCm: 122, MaxLengthCm: 1830,  // 4→60 pi : 14 pas
            BasePrice: 874.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [320], ClearHeightsCm: [213, 244, 274]),

        new("double-pointu", "Abri double pointu — Abris Tempo", "abris-doubles",
            LengthStepCm: 122, MinLengthCm: 122, MaxLengthCm: 1342,  // 4→44 pi : 10 pas
            BasePrice: 724.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [488, 549, 610], ClearHeightsCm: [198, 229, 259, 290]),

        new("double-rond", "Abri double rond — Abris Tempo", "abris-doubles",
            LengthStepCm: 152, MinLengthCm: 457, MaxLengthCm: 1065,  // 15→35 pi : 4 pas
            BasePrice: 1149.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [549, 610], ClearHeightsCm: [213, 239]),
    ];

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
    /// Cœur idempotent du seed. Crée par SLUG les modèles de référence absents ; ne touche jamais
    /// un modèle existant (préserve une édition admin) ; <c>SaveChanges</c> seulement si ajout.
    /// </summary>
    // internal (et non private) pour permettre un test de non-régression direct (L-005) ; le projet
    // UnitTest a déjà InternalsVisibleTo. Cf. ShelterModelSeederBackfillTests.
    internal static async Task SeedAsync(ApplicationDbContext db, ILogger logger)
    {
        // Catégories existantes (par slug) — semées par ProductSeeder. On rattache à l'existant.
        // GroupBy + First (et NON ToDictionaryAsync) : tolérant à d'éventuels slugs en double dans
        // le store (l'hôte de test partage une base InMemory où ProductSeeder peut s'exécuter sur
        // plusieurs hôtes parallèles → catégories dupliquées). Un ToDictionary lèverait « clé déjà
        // présente » ; ici on prend simplement la 1re catégorie par slug (déterministe par Id).
        var categories = await db.ProductCategories
            .Select(c => new { c.Slug, c.Id })
            .ToListAsync();
        var categoriesBySlug = categories
            .GroupBy(c => c.Slug)
            .ToDictionary(g => g.Key, g => g.OrderBy(c => c.Id).First().Id);

        // Slugs de modèles déjà présents (y compris soft-deleted : .IgnoreQueryFilters() pour ne pas
        // réinsérer un slug retiré, ce qui violerait l'index unique filtré au moment d'un restore).
        var existingSlugs = await db.ShelterModels
            .IgnoreQueryFilters()
            .Select(m => m.Slug)
            .ToHashSetAsync();

        var added = 0;

        foreach (var spec in Specs)
        {
            if (existingSlugs.Contains(spec.Slug))
                continue; // déjà présent → jamais écrasé (préserve une éventuelle édition admin).

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
                spec.BasePrice, spec.PricePerArchCents,
                spec.WidthsCm, spec.ClearHeightsCm);

            await db.ShelterModels.AddAsync(model);
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation(
                "Référentiel des modèles d'abris : {Count} modèle(s) ajouté(s).", added);
        }
    }
}
