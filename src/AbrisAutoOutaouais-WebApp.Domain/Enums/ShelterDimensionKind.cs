namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

/// <summary>
/// Nature d'une dimension configurable d'un modèle d'abri paramétrique.
/// Un modèle expose une ou plusieurs largeurs et une ou plusieurs hauteurs dégagées ;
/// la longueur, elle, est continue (pas configurable) et gérée par pas (<c>LengthStepCm</c>).
/// </summary>
public enum ShelterDimensionKind
{
    /// <summary>Largeur de l'abri (en centimètres).</summary>
    Width = 0,

    /// <summary>Hauteur dégagée sous l'abri (en centimètres).</summary>
    ClearHeight = 1,
}
