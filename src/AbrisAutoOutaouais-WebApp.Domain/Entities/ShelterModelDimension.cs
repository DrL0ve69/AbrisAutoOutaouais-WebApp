using AbrisAutoOutaouais_WebApp.Domain.Enums;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Dimension configurable d'un <see cref="ShelterModel"/> (une largeur ou une hauteur dégagée
/// proposée pour ce modèle). Entité enfant RÉGULIÈRE de <c>ShelterModel</c> (et non un owned-type) :
/// elle a sa propre table et doit être chargée explicitement via <c>.Include(m =&gt; m.Dimensions)</c>.
///
/// Porte une clé identifiante propre (<see cref="Id"/> Guid) : sans clé propre, EF devrait deviner
/// une clé shadow et la persistance deviendrait fragile (piège relationnel de L-001). Ici la clé
/// est explicite et stable.
/// </summary>
public sealed class ShelterModelDimension
{
    public Guid Id { get; private set; }

    /// <summary>Largeur ou hauteur dégagée.</summary>
    public ShelterDimensionKind Kind { get; private set; }

    /// <summary>Valeur en centimètres (toujours &gt; 0).</summary>
    public int ValueCm { get; private set; }

    private ShelterModelDimension() { }

    internal static ShelterModelDimension Create(ShelterDimensionKind kind, int valueCm)
    {
        if (valueCm <= 0)
            throw new ArgumentException("Une dimension doit être strictement positive.", nameof(valueCm));

        return new ShelterModelDimension
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            ValueCm = valueCm,
        };
    }
}
