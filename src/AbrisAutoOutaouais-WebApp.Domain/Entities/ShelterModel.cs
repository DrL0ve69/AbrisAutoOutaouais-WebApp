using AbrisAutoOutaouais_WebApp.Domain.Enums;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Modèle d'abri PARAMÉTRIQUE : un gabarit dont le client configure les dimensions.
/// Contrairement à <see cref="Product"/> (un article fixe au catalogue), un <c>ShelterModel</c>
/// décrit un référentiel de choix possibles :
///  - une ou plusieurs LARGEURS proposées (<see cref="ShelterDimensionKind.Width"/>),
///  - une ou plusieurs HAUTEURS dégagées proposées (<see cref="ShelterDimensionKind.ClearHeight"/>),
///  - une LONGUEUR continue, choisie par pas (<see cref="LengthStepCm"/>) entre
///    <see cref="MinLengthCm"/> et <see cref="MaxLengthCm"/>.
///
/// Le prix NE se calcule plus par une formule linéaire (base + nb d'arches) : il dépend des TROIS
/// axes (modèle × longueur × hauteur dégagée) et provient d'un LOOKUP dans une GRILLE EXACTE semée
/// (<see cref="PriceEntries"/>). Cette grille peut être ÉPARSE (toutes les combinaisons longueur/
/// hauteur n'existent pas pour tous les modèles, ex. double-rond). Le « à partir de » affiché au
/// catalogue est le minimum de la grille (<see cref="StartingPriceCents"/> — null si grille vide).
///
/// Hérite des bases audit/soft-delete COMME <see cref="Product"/> (<c>IAuditableEntity</c> +
/// <c>ISoftDeletable</c>) — mêmes interceptors EF, mêmes garanties.
/// </summary>
public sealed class ShelterModel : ISoftDeletable, IAuditableEntity
{
    private readonly List<ShelterModelDimension> _dimensions = [];
    private readonly List<ShelterPriceEntry> _priceEntries = [];

    public Guid Id { get; private set; }
    public string Slug { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;

    /// <summary>Catégorie produit associée (FK → <see cref="ProductCategory"/>).</summary>
    public Guid CategoryId { get; private set; }

    /// <summary>Pas de longueur configurable en centimètres (incrément entre options). Toujours &gt; 0.</summary>
    public int LengthStepCm { get; private set; }

    /// <summary>Longueur minimale en cm = longueur de BASE.</summary>
    public int MinLengthCm { get; private set; }

    /// <summary>Longueur maximale configurable en cm.</summary>
    public int MaxLengthCm { get; private set; }

    public ProductCategory Category { get; private set; } = null!;

    /// <summary>
    /// Expose la liste sous-jacente <c>_dimensions</c> (vue en lecture seule par le type
    /// <see cref="IReadOnlyList{T}"/>) SANS créer un nouveau wrapper à chaque accès : EF suit la
    /// navigation via ce champ, et un <c>AsReadOnly()</c> renvoyant une instance différente à chaque
    /// lecture casse la détection de changement de la collection (anciens enfants non marqués
    /// supprimés au remplacement en bloc). La mutation reste interdite hors de l'agrégat (membres
    /// publics <see cref="Create"/>/<see cref="Reconfigure"/> uniquement).
    /// </summary>
    public IReadOnlyList<ShelterModelDimension> Dimensions => _dimensions;

    /// <summary>
    /// Grille de prix EXACTE (entrées par longueur × hauteur dégagée). Même contrat d'exposition que
    /// <see cref="Dimensions"/> : la liste sous-jacente est exposée directement (EF suit la
    /// navigation via le champ <c>_priceEntries</c>) ; mutation uniquement via l'agrégat.
    /// </summary>
    public IReadOnlyList<ShelterPriceEntry> PriceEntries => _priceEntries;

    // ISoftDeletable
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    // IAuditableEntity
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private ShelterModel() { }

    /// <summary>
    /// Crée un modèle paramétrique en validant ses invariants :
    ///  - au moins une largeur ET au moins une hauteur dégagée ;
    ///  - <c>MinLengthCm &lt; MaxLengthCm</c> et <c>MinLengthCm &gt; 0</c> ;
    ///  - <c>LengthStepCm &gt; 0</c> et la plage [min, max] est un multiple entier du pas
    ///    (<c>(MaxLengthCm - MinLengthCm) % LengthStepCm == 0</c>) — sinon la longueur max ne
    ///    serait pas atteignable par pas.
    /// La grille de prix (<paramref name="priceEntries"/>) est OPTIONNELLE : un modèle créé par
    /// l'admin peut n'avoir aucune entrée (il reste non tarifé tant que la grille n'est pas semée).
    /// </summary>
    public static ShelterModel Create(
        string slug,
        string name,
        Guid categoryId,
        int lengthStepCm,
        int minLengthCm,
        int maxLengthCm,
        IReadOnlyList<int> widthsCm,
        IReadOnlyList<int> clearHeightsCm,
        IReadOnlyList<PriceEntryInput>? priceEntries = null)
    {
        ValidateInvariants(
            slug, name, categoryId, lengthStepCm, minLengthCm, maxLengthCm,
            widthsCm, clearHeightsCm);

        var model = new ShelterModel
        {
            Id = Guid.NewGuid(),
            Slug = slug.Trim().ToLowerInvariant(),
            Name = name.Trim(),
            CategoryId = categoryId,
            LengthStepCm = lengthStepCm,
            MinLengthCm = minLengthCm,
            MaxLengthCm = maxLengthCm,
        };

        foreach (var w in widthsCm)
            model._dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.Width, w));
        foreach (var h in clearHeightsCm)
            model._dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.ClearHeight, h));

        model.SetPriceGrid(priceEntries ?? []);

        return model;
    }

    /// <summary>
    /// Reconfigure un modèle EXISTANT (édition admin, EPIC 9.5). Le <see cref="Slug"/> est
    /// IMMUABLE : il n'est jamais modifié ici (on rejoue les invariants avec le slug courant).
    /// La collection des dimensions est remplacée EN BLOC (clear + ré-ajout) — possible car
    /// <see cref="ShelterModelDimension"/> est une entité régulière (cf. sa configuration EF) :
    /// EF supprime les anciennes lignes et insère les nouvelles. Mêmes invariants que
    /// <see cref="Create"/>.
    ///
    /// La GRILLE DE PRIX n'est PAS touchée ici : l'admin ne fixe plus les prix (décision propriétaire,
    /// grille en lecture seule semée). Voir <see cref="SetPriceGrid"/> pour (re)poser une grille
    /// (utilisé par le seeder uniquement).
    /// </summary>
    public void Reconfigure(
        string name,
        Guid categoryId,
        int lengthStepCm,
        int minLengthCm,
        int maxLengthCm,
        IReadOnlyList<int> widthsCm,
        IReadOnlyList<int> clearHeightsCm)
    {
        // Slug INCHANGÉ : on passe le slug courant à la validation (jamais réécrit).
        ValidateInvariants(
            Slug, name, categoryId, lengthStepCm, minLengthCm, maxLengthCm,
            widthsCm, clearHeightsCm);

        Name = name.Trim();
        CategoryId = categoryId;
        LengthStepCm = lengthStepCm;
        MinLengthCm = minLengthCm;
        MaxLengthCm = maxLengthCm;

        // Remplacement EN BLOC de la collection des dimensions.
        _dimensions.Clear();
        foreach (var w in widthsCm)
            _dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.Width, w));
        foreach (var h in clearHeightsCm)
            _dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.ClearHeight, h));
    }

    /// <summary>
    /// (Re)pose la grille de prix EN BLOC (clear + ré-ajout) — même patron que la collection des
    /// dimensions, réservé au seed du référentiel (l'admin ne fixe pas les prix). Rejette une grille
    /// contenant des doublons (longueur, hauteur) : la clé (longueur × hauteur) doit être unique pour
    /// que le lookup <see cref="PriceFor"/> soit déterministe (et l'index unique en base cohérent).
    /// </summary>
    public void SetPriceGrid(IReadOnlyList<PriceEntryInput> priceEntries)
    {
        ArgumentNullException.ThrowIfNull(priceEntries);

        var seen = new HashSet<(int Length, int Height)>();
        foreach (var e in priceEntries)
        {
            if (!seen.Add((e.LengthCm, e.ClearHeightCm)))
                throw new ArgumentException(
                    $"Entrée de grille en double pour (longueur {e.LengthCm} cm, hauteur {e.ClearHeightCm} cm).",
                    nameof(priceEntries));
        }

        _priceEntries.Clear();
        foreach (var e in priceEntries)
            _priceEntries.Add(ShelterPriceEntry.Create(e.LengthCm, e.ClearHeightCm, e.PriceCents));
    }

    /// <summary>
    /// Gardes communes à <see cref="Create"/> et <see cref="Reconfigure"/> (DRY). Lève les mêmes
    /// <see cref="ArgumentException"/> qu'avant l'extraction. La tarification ne fait PLUS partie des
    /// invariants structurels (grille externe semée).
    /// </summary>
    private static void ValidateInvariants(
        string slug,
        string name,
        Guid categoryId,
        int lengthStepCm,
        int minLengthCm,
        int maxLengthCm,
        IReadOnlyList<int> widthsCm,
        IReadOnlyList<int> clearHeightsCm)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (categoryId == Guid.Empty)
            throw new ArgumentException("La catégorie est requise.", nameof(categoryId));

        if (widthsCm is null || widthsCm.Count == 0)
            throw new ArgumentException("Au moins une largeur est requise.", nameof(widthsCm));
        if (clearHeightsCm is null || clearHeightsCm.Count == 0)
            throw new ArgumentException("Au moins une hauteur dégagée est requise.", nameof(clearHeightsCm));

        if (lengthStepCm <= 0)
            throw new ArgumentException("Le pas de longueur doit être strictement positif.", nameof(lengthStepCm));
        if (minLengthCm <= 0)
            throw new ArgumentException("La longueur minimale doit être strictement positive.", nameof(minLengthCm));
        if (minLengthCm >= maxLengthCm)
            throw new ArgumentException("La longueur minimale doit être inférieure à la maximale.", nameof(minLengthCm));
        if ((maxLengthCm - minLengthCm) % lengthStepCm != 0)
            throw new ArgumentException(
                "La plage de longueur doit être un multiple entier du pas.", nameof(lengthStepCm));
    }

    /// <summary>Largeurs proposées, en cm, triées croissant.</summary>
    public IReadOnlyList<int> WidthOptionsCm =>
        _dimensions
            .Where(d => d.Kind == ShelterDimensionKind.Width)
            .Select(d => d.ValueCm)
            .OrderBy(v => v)
            .ToList();

    /// <summary>Hauteurs dégagées proposées, en cm, triées croissant.</summary>
    public IReadOnlyList<int> ClearHeightOptionsCm =>
        _dimensions
            .Where(d => d.Kind == ShelterDimensionKind.ClearHeight)
            .Select(d => d.ValueCm)
            .OrderBy(v => v)
            .ToList();

    /// <summary>
    /// Prix de départ (« à partir de ») en CENTS = minimum de la grille de prix ; <c>null</c> si la
    /// grille est vide (modèle non tarifé, ex. créé par l'admin sans grille semée). Nécessite que
    /// <see cref="PriceEntries"/> soit chargée (<c>.Include</c>) — sinon retourne null à tort (L-035).
    /// </summary>
    public int? StartingPriceCents =>
        _priceEntries.Count == 0 ? null : _priceEntries.Min(e => e.PriceCents);

    /// <summary>
    /// Prix de départ EN DOLLARS (« à partir de ») = <see cref="StartingPriceCents"/> ÷ 100, ou
    /// <c>0</c> si la grille est vide (modèle non tarifé). Source unique de la conversion cents →
    /// dollars du « à partir de » (L-004), réutilisée par tous les DTO de lecture qui exposaient
    /// l'ancien champ <c>BasePrice</c>. Nécessite <see cref="PriceEntries"/> chargée (L-035).
    /// </summary>
    public decimal StartingPrice =>
        StartingPriceCents is { } cents ? cents / 100m : 0m;

    /// <summary>
    /// Lookup du prix EXACT en CENTS pour une combinaison (longueur, hauteur dégagée) ; <c>null</c>
    /// si cette combinaison n'existe pas dans la grille (grille éparse). Nécessite
    /// <see cref="PriceEntries"/> chargée (L-035).
    /// </summary>
    public int? PriceFor(int lengthCm, int clearHeightCm) =>
        _priceEntries
            .FirstOrDefault(e => e.LengthCm == lengthCm && e.ClearHeightCm == clearHeightCm)
            ?.PriceCents;

    /// <summary>
    /// Donnée d'entrée pour (re)poser une entrée de grille de prix : prix (en CENTS) pour une
    /// combinaison (longueur × hauteur dégagée), en cm. Sert d'argument à <see cref="Create"/> et
    /// <see cref="SetPriceGrid"/> sans exposer le constructeur de <see cref="ShelterPriceEntry"/>.
    /// </summary>
    public readonly record struct PriceEntryInput(int LengthCm, int ClearHeightCm, int PriceCents);
}
