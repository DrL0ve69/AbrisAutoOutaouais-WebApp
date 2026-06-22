using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Résout le prix EXACT d'un modèle d'abri pour une combinaison (longueur × hauteur dégagée) par
/// LOOKUP dans sa grille de prix semée.
///
/// Slug inconnu → <see cref="NotFoundException"/> (404). Combinaison (longueur, hauteur) ABSENTE de
/// la grille → <see cref="BusinessRuleException"/> (422). Ce contrôle est fait ICI, AVANT d'appeler
/// le calculateur de domaine : <c>ShelterPriceCalculator</c> lève <see cref="ArgumentOutOfRangeException"/>
/// sur une combinaison absente (→ 500 non géré), ce qui serait une erreur serveur pour une saisie
/// utilisateur. On transforme donc ce cas en 422 propre. Le calcul lui-même n'est JAMAIS refait à la
/// main : on délègue à <see cref="ShelterPriceCalculator"/> (source unique — L-004).
///
/// La grille (<c>PriceEntries</c>) est une entité RÉGULIÈRE → <c>.Include</c> EXPLICITE requis
/// (L-035) ; <c>AsNoTracking()</c> : lecture seule. <c>HandleAsync</c> porte la logique ; <c>Handle</c>
/// satisfait l'interface et délègue.
/// </summary>
public sealed class GetShelterPriceQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetShelterPriceQuery, ShelterPriceDto>
{
    public async Task<ShelterPriceDto> HandleAsync(
        GetShelterPriceQuery query, CancellationToken ct)
    {
        var model = await db.ShelterModels
            .AsNoTracking()
            .Include(m => m.PriceEntries)
            .FirstOrDefaultAsync(m => m.Slug == query.Slug, ct)
            ?? throw new NotFoundException(nameof(ShelterModel), query.Slug);

        // Lookup dans la grille AVANT le calculateur (sinon ArgumentOutOfRangeException → 500). Une
        // grille éparse peut ne pas avoir cette combinaison même si la longueur est « dans la plage ».
        if (model.PriceFor(query.LengthCm, query.ClearHeightCm) is null)
            throw new BusinessRuleException(
                $"Aucun prix disponible pour la combinaison longueur {query.LengthCm} cm × " +
                $"hauteur dégagée {query.ClearHeightCm} cm pour ce modèle.");

        var total = ShelterPriceCalculator.CalculatePrice(model, query.LengthCm, query.ClearHeightCm);

        return new ShelterPriceDto(
            model.Id, model.Slug, query.LengthCm, query.ClearHeightCm, total);
    }

    public ValueTask<ShelterPriceDto> Handle(GetShelterPriceQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
