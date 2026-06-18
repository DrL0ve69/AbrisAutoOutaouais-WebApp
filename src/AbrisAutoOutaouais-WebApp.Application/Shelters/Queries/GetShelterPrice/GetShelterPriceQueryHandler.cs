using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;

/// <summary>
/// Calcule le prix d'un modèle d'abri pour une longueur configurée.
///
/// Slug inconnu → <see cref="NotFoundException"/> (404). Longueur hors plage [Min, Max] OU
/// désalignée sur le pas → <see cref="BusinessRuleException"/> (422). Ce contrôle est fait ICI,
/// AVANT d'appeler le calculateur de domaine : <c>ShelterPriceCalculator</c> lève
/// <see cref="ArgumentOutOfRangeException"/> sur une longueur invalide (→ 500 non géré), ce qui
/// serait une erreur serveur pour une saisie utilisateur incorrecte. On transforme donc ce cas en
/// 422 propre. Le calcul lui-même n'est JAMAIS refait à la main : on délègue entièrement à
/// <see cref="ShelterPriceCalculator"/> (source unique de la formule — L-004).
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class GetShelterPriceQueryHandler(IApplicationDbContext db)
    : IQueryHandler<GetShelterPriceQuery, ShelterPriceDto>
{
    public async Task<ShelterPriceDto> HandleAsync(
        GetShelterPriceQuery query, CancellationToken ct)
    {
        var model = await db.ShelterModels
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Slug == query.Slug, ct)
            ?? throw new NotFoundException(nameof(ShelterModel), query.Slug);

        // Bornes + alignement validés AVANT le calculateur (sinon ArgumentOutOfRangeException → 500).
        if (query.LengthCm < model.MinLengthCm || query.LengthCm > model.MaxLengthCm)
            throw new BusinessRuleException(
                $"La longueur doit être comprise entre {model.MinLengthCm} et {model.MaxLengthCm} cm.");

        if ((query.LengthCm - model.MinLengthCm) % model.LengthStepCm != 0)
            throw new BusinessRuleException(
                $"La longueur doit être alignée sur le pas de {model.LengthStepCm} cm depuis {model.MinLengthCm} cm.");

        var archCount = ShelterPriceCalculator.ArchCount(model, query.LengthCm);
        var total = ShelterPriceCalculator.CalculatePrice(model, query.LengthCm);

        return new ShelterPriceDto(model.Id, model.Slug, query.LengthCm, archCount, total);
    }

    public ValueTask<ShelterPriceDto> Handle(GetShelterPriceQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
