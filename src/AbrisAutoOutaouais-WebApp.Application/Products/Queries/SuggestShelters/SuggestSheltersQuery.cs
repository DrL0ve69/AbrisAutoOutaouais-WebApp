using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.SuggestShelters;

/// <summary>
/// Suggère les abris dont l'empreinte au sol couvre les dimensions requises
/// (largeur ET longueur, en cm). Retourne les candidats triés du plus petit
/// suffisant au plus grand, chacun annoté de ses marges et d'un drapeau
/// <c>IsTightFit</c> lorsqu'une marge est inférieure au seuil métier.
/// </summary>
public sealed record SuggestSheltersQuery(int RequiredWidthCm, int RequiredLengthCm)
    : IQuery<IReadOnlyList<ShelterSuggestionDto>>;
