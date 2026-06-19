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
/// Le prix se calcule à partir du nombre d'arches (cf. <c>ShelterPriceCalculator</c>) : chaque pas
/// de longueur au-delà de la longueur de base (= <see cref="MinLengthCm"/>) ajoute une arche.
///
/// Hérite des bases audit/soft-delete COMME <see cref="Product"/> (<c>IAuditableEntity</c> +
/// <c>ISoftDeletable</c>) — mêmes interceptors EF, mêmes garanties.
/// </summary>
public sealed class ShelterModel : ISoftDeletable, IAuditableEntity
{
    private readonly List<ShelterModelDimension> _dimensions = [];

    public Guid Id { get; private set; }
    public string Slug { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;

    /// <summary>Catégorie produit associée (FK → <see cref="ProductCategory"/>).</summary>
    public Guid CategoryId { get; private set; }

    /// <summary>Pas de longueur en centimètres (incrément d'une arche). Toujours &gt; 0.</summary>
    public int LengthStepCm { get; private set; }

    /// <summary>Longueur minimale en cm = longueur de BASE (0 arche supplémentaire).</summary>
    public int MinLengthCm { get; private set; }

    /// <summary>Longueur maximale configurable en cm.</summary>
    public int MaxLengthCm { get; private set; }

    /// <summary>Prix de base (longueur = <see cref="MinLengthCm"/>), en dollars.</summary>
    public decimal BasePrice { get; private set; }

    /// <summary>Prix par arche supplémentaire, en cents (cf. <c>ShelterPricing</c>).</summary>
    public int PricePerArchCents { get; private set; }

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
    ///    serait pas atteignable par pas ;
    ///  - prix de base et prix/arche &gt;= 0.
    /// </summary>
    public static ShelterModel Create(
        string slug,
        string name,
        Guid categoryId,
        int lengthStepCm,
        int minLengthCm,
        int maxLengthCm,
        decimal basePrice,
        int pricePerArchCents,
        IReadOnlyList<int> widthsCm,
        IReadOnlyList<int> clearHeightsCm)
    {
        ValidateInvariants(
            slug, name, categoryId, lengthStepCm, minLengthCm, maxLengthCm,
            basePrice, pricePerArchCents, widthsCm, clearHeightsCm);

        var model = new ShelterModel
        {
            Id = Guid.NewGuid(),
            Slug = slug.Trim().ToLowerInvariant(),
            Name = name.Trim(),
            CategoryId = categoryId,
            LengthStepCm = lengthStepCm,
            MinLengthCm = minLengthCm,
            MaxLengthCm = maxLengthCm,
            BasePrice = basePrice,
            PricePerArchCents = pricePerArchCents,
        };

        foreach (var w in widthsCm)
            model._dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.Width, w));
        foreach (var h in clearHeightsCm)
            model._dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.ClearHeight, h));

        return model;
    }

    /// <summary>
    /// Reconfigure un modèle EXISTANT (édition admin, EPIC 9.5). Le <see cref="Slug"/> est
    /// IMMUABLE : il n'est jamais modifié ici (on rejoue les invariants avec le slug courant).
    /// La collection des dimensions est remplacée EN BLOC (clear + ré-ajout) — possible car
    /// <see cref="ShelterModelDimension"/> est une entité régulière (cf. sa configuration EF) :
    /// EF supprime les anciennes lignes et insère les nouvelles. Mêmes invariants que
    /// <see cref="Create"/>.
    /// </summary>
    public void Reconfigure(
        string name,
        Guid categoryId,
        int lengthStepCm,
        int minLengthCm,
        int maxLengthCm,
        decimal basePrice,
        int pricePerArchCents,
        IReadOnlyList<int> widthsCm,
        IReadOnlyList<int> clearHeightsCm)
    {
        // Slug INCHANGÉ : on passe le slug courant à la validation (jamais réécrit).
        ValidateInvariants(
            Slug, name, categoryId, lengthStepCm, minLengthCm, maxLengthCm,
            basePrice, pricePerArchCents, widthsCm, clearHeightsCm);

        Name = name.Trim();
        CategoryId = categoryId;
        LengthStepCm = lengthStepCm;
        MinLengthCm = minLengthCm;
        MaxLengthCm = maxLengthCm;
        BasePrice = basePrice;
        PricePerArchCents = pricePerArchCents;

        // Remplacement EN BLOC de la collection des dimensions.
        _dimensions.Clear();
        foreach (var w in widthsCm)
            _dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.Width, w));
        foreach (var h in clearHeightsCm)
            _dimensions.Add(ShelterModelDimension.Create(ShelterDimensionKind.ClearHeight, h));
    }

    /// <summary>
    /// Gardes communes à <see cref="Create"/> et <see cref="Reconfigure"/> (DRY). Lève les mêmes
    /// <see cref="ArgumentException"/> qu'avant l'extraction.
    /// </summary>
    private static void ValidateInvariants(
        string slug,
        string name,
        Guid categoryId,
        int lengthStepCm,
        int minLengthCm,
        int maxLengthCm,
        decimal basePrice,
        int pricePerArchCents,
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

        if (basePrice < 0)
            throw new ArgumentException("Le prix de base ne peut pas être négatif.", nameof(basePrice));
        if (pricePerArchCents < 0)
            throw new ArgumentException("Le prix par arche ne peut pas être négatif.", nameof(pricePerArchCents));
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
}
