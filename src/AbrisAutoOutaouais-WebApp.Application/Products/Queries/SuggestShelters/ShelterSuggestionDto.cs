namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.SuggestShelters;

/// <summary>
/// Abri candidat à une demande de dimensions. Comme les résultats sont filtrés sur
/// des dimensions non-null, <see cref="WidthCm"/> et <see cref="LengthCm"/> sont
/// garantis renseignés (<c>int</c>) ; <see cref="HeightCm"/> reste optionnel.
/// <see cref="WidthMarginCm"/>/<see cref="LengthMarginCm"/> sont l'excédent par rapport
/// aux dimensions requises (≥ 0). <see cref="IsTightFit"/> est vrai si l'une des marges
/// est sous <see cref="Domain.Constants.ProductDimensions.TightFitMarginCm"/>.
/// <see cref="Brand"/>/<see cref="Model"/> sont la marque et le modèle du catalogue (G3),
/// repris tels quels (texte du catalogue, format inchangé — L-004/L-011) ; optionnels.
/// </summary>
public sealed record ShelterSuggestionDto(
    Guid Id,
    string Name,
    string Slug,
    decimal Price,
    decimal? RentalPrice,
    string CategoryName,
    string? ImageUrl,
    int WidthCm,
    int LengthCm,
    int? HeightCm,
    int WidthMarginCm,
    int LengthMarginCm,
    bool IsTightFit,
    string? Brand,
    string? Model);
