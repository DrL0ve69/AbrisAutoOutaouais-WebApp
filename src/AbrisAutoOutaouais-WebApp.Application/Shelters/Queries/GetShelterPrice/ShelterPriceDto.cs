namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Résultat d'un calcul de prix : longueur retenue, nombre d'arches supplémentaires déduit et
/// prix total (en dollars). Le calcul délègue entièrement à <c>ShelterPriceCalculator</c> (L-004).
/// </summary>
public sealed record ShelterPriceDto(
    Guid ModelId,
    string Slug,
    int LengthCm,
    int ArchCount,
    decimal TotalPrice);
