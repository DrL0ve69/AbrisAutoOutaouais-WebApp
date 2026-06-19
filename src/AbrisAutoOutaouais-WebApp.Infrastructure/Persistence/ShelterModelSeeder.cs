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
/// est ABSENT ; un modèle déjà présent n'est JAMAIS écrasé (un admin a pu l'éditer). En plus, les
/// anciens modèles MULTI-LARGEURS (cf. <see cref="LegacyMultiWidthSlugs"/>) sont soft-deletés au
/// passage (le rework EPIC 9 fait d'une largeur = un modèle distinct). Un 2e passage ne change donc
/// rien (aucun <c>SaveChanges</c> si rien n'a été ajouté NI retiré). N'utilise que des opérations EF
/// compatibles InMemory — pas de SQL brut (les tests d'intégration bootent sur InMemory, L-022).
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
    /// Référentiel validé (EPIC 9, rework). RÈGLE : <b>une largeur = un modèle distinct</b>
    /// (« Abri simple 11 pi » et « Abri simple 12 pi » sont DEUX modèles, pas un seul à deux
    /// largeurs). Chaque spec n'a donc qu'UNE valeur dans <see cref="ShelterModelSpec.WidthsCm"/>.
    /// Cela remplace les anciens modèles multi-largeurs (<c>simple</c>/<c>double-pointu</c>/
    /// <c>double-rond</c>) — retirés par <see cref="LegacyMultiWidthSlugs"/> dans <c>SeedAsync</c>.
    /// Largeurs/hauteurs en cm ; longueurs par pas entre min et max.
    ///
    /// NOTE (longueurs réalistes par pas) : longueurs en conversions de PIEDS (4 pi = 122 cm,
    /// 5 pi = 152 cm). L'invariant de domaine exige <c>(Max - Min) % Step == 0</c> (la longueur max
    /// doit être atteignable par pas depuis la base). On dérive donc max comme <c>Min + N × Step</c> :
    ///  - simple/monopente : 16→60 pi par pas de 4 pi → min 488, max 1830 (11 pas) ;
    ///  - double-pointu   : 16→44 pi par pas de 4 pi → min 488, max 1342 (7 pas) ;
    ///  - double-rond     : 15→35 pi par pas de 5 pi → min 457, max 1065 (4 pas). 35 pi ≈ 1067 cm,
    ///    arrondi à 1065 pour rester un multiple exact du pas de 152 cm (l'écart au cm près est sans
    ///    incidence métier — le pas reste exact).
    ///
    /// Prix : placeholders cohérents (11 pi &lt; 12 pi &lt; double). PricePerArchCents = 15000 par
    /// défaut ; 18000 pour le double-rond (arches plus larges).
    /// </summary>
    private static readonly IReadOnlyList<ShelterModelSpec> Specs =
    [
        new("simple-11pi", "Abri simple 11 pi — Abris Tempo", "abris-simples",
            LengthStepCm: 122, MinLengthCm: 488, MaxLengthCm: 1830,  // 16→60 pi : 11 pas
            BasePrice: 1099.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [335], ClearHeightsCm: [198]),

        new("simple-12pi", "Abri simple 12 pi — Abris Tempo", "abris-simples",
            LengthStepCm: 122, MinLengthCm: 488, MaxLengthCm: 1830,  // 16→60 pi : 11 pas
            BasePrice: 1249.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [366], ClearHeightsCm: [198]),

        new("monopente", "Abri monopente 10 pi ½ — Abris Tempo", "abris-simples",
            LengthStepCm: 122, MinLengthCm: 488, MaxLengthCm: 1830,  // 16→60 pi : 11 pas
            BasePrice: 1349.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [320], ClearHeightsCm: [213, 244, 274]),

        new("double-pointu-16pi", "Abri double pointu 16 pi — Abris Tempo", "abris-doubles",
            LengthStepCm: 122, MinLengthCm: 488, MaxLengthCm: 1342,  // 16→44 pi : 7 pas
            BasePrice: 1899.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [488], ClearHeightsCm: [198, 229, 259]),

        new("double-pointu-18pi", "Abri double pointu 18 pi — Abris Tempo", "abris-doubles",
            LengthStepCm: 122, MinLengthCm: 488, MaxLengthCm: 1342,  // 16→44 pi : 7 pas
            BasePrice: 2099.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [549], ClearHeightsCm: [198, 229, 259]),

        new("double-pointu-20pi", "Abri double pointu 20 pi — Abris Tempo", "abris-doubles",
            LengthStepCm: 122, MinLengthCm: 488, MaxLengthCm: 1342,  // 16→44 pi : 7 pas
            BasePrice: 2299.00m, PricePerArchCents: ShelterPricing.DefaultPricePerArchCents,
            WidthsCm: [610], ClearHeightsCm: [198, 229, 259]),

        new("double-rond-18pi", "Abri double rond 18 pi — Abris Tempo", "abris-doubles",
            LengthStepCm: 152, MinLengthCm: 457, MaxLengthCm: 1065,  // 15→35 pi : 4 pas
            BasePrice: 2499.00m, PricePerArchCents: 18000,
            WidthsCm: [549], ClearHeightsCm: [213, 239]),

        new("double-rond-20pi", "Abri double rond 20 pi — Abris Tempo", "abris-doubles",
            LengthStepCm: 152, MinLengthCm: 457, MaxLengthCm: 1065,  // 15→35 pi : 4 pas
            BasePrice: 2699.00m, PricePerArchCents: 18000,
            WidthsCm: [610], ClearHeightsCm: [213, 239]),
    ];

    /// <summary>
    /// Anciens slugs MULTI-LARGEURS remplacés par les modèles par-largeur de <see cref="Specs"/>.
    /// Soft-deletés (idempotemment) au seed pour ne plus apparaître au catalogue. <c>monopente</c>
    /// est CONSERVÉ (toujours une seule largeur) : il n'est PAS dans cet ensemble.
    /// </summary>
    private static readonly IReadOnlySet<string> LegacyMultiWidthSlugs =
        new HashSet<string>(StringComparer.Ordinal) { "simple", "double-pointu", "double-rond" };

    /// <summary>
    /// Vue de test (L-005) sur les invariants dimensionnels de chaque spec du référentiel : permet à
    /// un test-garde d'asserter <c>(Max - Min) % Step == 0</c> et « une seule largeur par modèle »
    /// SANS exposer le record privé. <c>internal</c> car le projet UnitTest a <c>InternalsVisibleTo</c>.
    /// </summary>
    internal sealed record SpecInvariant(
        string Slug, int LengthStepCm, int MinLengthCm, int MaxLengthCm, int WidthCount);

    /// <summary>Invariants dimensionnels des specs semées (pour le test-garde).</summary>
    internal static IReadOnlyList<SpecInvariant> SpecInvariants =>
        Specs
            .Select(s => new SpecInvariant(
                s.Slug, s.LengthStepCm, s.MinLengthCm, s.MaxLengthCm, s.WidthsCm.Count))
            .ToList();

    /// <summary>Slugs des modèles par-largeur semés (pour les tests).</summary>
    internal static IReadOnlyList<string> SeededSlugs =>
        Specs.Select(s => s.Slug).ToList();

    /// <summary>Anciens slugs multi-largeurs retirés au seed (pour les tests).</summary>
    internal static IReadOnlySet<string> LegacySlugs => LegacyMultiWidthSlugs;

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
    /// EPIC 9) ; crée par SLUG les modèles par-largeur absents ; ne touche jamais un modèle existant
    /// (préserve une édition admin) ; <c>SaveChanges</c> unique, seulement si retrait OU ajout.
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

        var changed = false;

        // ── Retrait des anciens modèles multi-largeurs (idempotent) ──────────────────────────────
        // On SOFT-DELETE tout ShelterModel dont le slug est un ancien slug multi-largeurs (remplacé
        // par les modèles par-largeur ci-dessus). On passe par .Remove() : le SoftDeleteInterceptor
        // le convertit en IsDeleted=true (état Modified, aucune opération relationnelle → sûr sur
        // InMemory, L-022/L-035). .IgnoreQueryFilters() pour les retrouver même déjà soft-deletés,
        // et on ne ré-supprime QUE ceux encore actifs (idempotence : 2e passage = aucun changement).
        var legacyModels = await db.ShelterModels
            .IgnoreQueryFilters()
            .Where(m => LegacyMultiWidthSlugs.Contains(m.Slug) && !m.IsDeleted)
            .ToListAsync();

        if (legacyModels.Count > 0)
        {
            db.ShelterModels.RemoveRange(legacyModels);
            changed = true;
            logger.LogInformation(
                "Référentiel des modèles d'abris : {Count} ancien(s) modèle(s) multi-largeurs retiré(s).",
                legacyModels.Count);
        }

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
            changed = true;
            logger.LogInformation(
                "Référentiel des modèles d'abris : {Count} modèle(s) ajouté(s).", added);
        }

        // Un seul SaveChanges pour le retrait des anciens slugs ET l'ajout des nouveaux.
        if (changed)
            await db.SaveChangesAsync();
    }
}
