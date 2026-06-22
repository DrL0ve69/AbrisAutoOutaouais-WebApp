namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Une entrée de la GRILLE DE PRIX EXACTE d'un <see cref="ShelterModel"/> : le prix (en cents) pour
/// une combinaison précise (longueur × hauteur dégagée). Le prix d'un abri dépend des TROIS axes
/// (modèle × longueur × hauteur dégagée) — il ne se déduit donc plus d'une formule linéaire mais
/// d'un LOOKUP dans cette grille. Les grilles peuvent être ÉPARSES : certaines combinaisons
/// (longueur, hauteur) n'existent simplement pas pour un modèle donné (ex. double-rond).
///
/// Entité enfant RÉGULIÈRE de <c>ShelterModel</c> (et non un owned-type), calquée sur
/// <see cref="ShelterModelDimension"/> : table propre, FK <c>ShelterModelId</c>, clé identifiante
/// <see cref="Id"/> (Guid) — elle doit être chargée explicitement via
/// <c>.Include(m =&gt; m.PriceEntries)</c> (plus d'auto-include owned, cf. L-035). N'est PAS
/// <c>ISoftDeletable</c> (pas plus que <see cref="ShelterModelDimension"/>) : la grille suit le
/// cycle de vie de son modèle parent (cascade).
/// </summary>
public sealed class ShelterPriceEntry
{
    public Guid Id { get; private set; }

    /// <summary>FK vers le modèle parent (cf. configuration EF, FK shadow/explicite).</summary>
    public Guid ShelterModelId { get; private set; }

    /// <summary>Longueur configurée en centimètres (toujours &gt; 0).</summary>
    public int LengthCm { get; private set; }

    /// <summary>Hauteur dégagée en centimètres (toujours &gt; 0).</summary>
    public int ClearHeightCm { get; private set; }

    /// <summary>Prix EXACT en CENTS pour cette combinaison (toujours &gt; 0).</summary>
    public int PriceCents { get; private set; }

    private ShelterPriceEntry() { }

    /// <summary>
    /// Fabrique de domaine : valide les invariants (longueur, hauteur et prix strictement positifs).
    /// <c>internal</c> car une entrée de grille ne se crée que via l'agrégat <see cref="ShelterModel"/>.
    /// </summary>
    internal static ShelterPriceEntry Create(int lengthCm, int clearHeightCm, int priceCents)
    {
        if (lengthCm <= 0)
            throw new ArgumentException("La longueur doit être strictement positive.", nameof(lengthCm));
        if (clearHeightCm <= 0)
            throw new ArgumentException("La hauteur dégagée doit être strictement positive.", nameof(clearHeightCm));
        if (priceCents <= 0)
            throw new ArgumentException("Le prix doit être strictement positif.", nameof(priceCents));

        return new ShelterPriceEntry
        {
            Id = Guid.NewGuid(),
            LengthCm = lengthCm,
            ClearHeightCm = clearHeightCm,
            PriceCents = priceCents,
        };
    }
}
