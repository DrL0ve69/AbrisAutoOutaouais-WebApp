using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.UpdateShelterModel;

/// <summary>
/// Charge le modèle SUIVI avec ses dimensions — entités RÉGULIÈRES (et non owned), donc chargées
/// explicitement via <c>.Include(m =&gt; m.Dimensions)</c> —, vérifie l'existence de la catégorie,
/// applique <see cref="ShelterModel.Reconfigure"/> (slug inchangé) puis sauvegarde.
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class UpdateShelterModelCommandHandler(IApplicationDbContext db)
    : ICommandHandler<UpdateShelterModelCommand, bool>
{
    public async Task<bool> HandleAsync(UpdateShelterModelCommand command, CancellationToken ct)
    {
        // Charge le modèle SUIVI avec ses dimensions dans le change tracker (Include sur requête
        // suivie). Indispensable avant de remplacer la collection : il faut connaître les lignes
        // existantes pour les retirer explicitement.
        var model = await db.ShelterModels
            .Include(m => m.Dimensions)
            .FirstOrDefaultAsync(m => m.Id == command.Id, ct)
            ?? throw new NotFoundException(nameof(ShelterModel), command.Id);

        var categoryExists = await db.ProductCategories
            .AnyAsync(c => c.Id == command.CategoryId, ct);
        if (!categoryExists)
            throw new NotFoundException(nameof(ProductCategory), command.CategoryId);

        // Remplacement explicite de la collection de dimensions, robuste sur tous les fournisseurs
        // EF (y compris InMemory en test/CI) : on retire les anciennes lignes, on laisse le domaine
        // recomposer la collection (Reconfigure : clear + ré-ajout d'instances neuves), puis on
        // marque ces nouvelles lignes comme ajoutées. Sans ce marquage explicite, EF ne déduit pas
        // correctement l'ajout d'enfants à un parent déjà suivi (il les laisse en Modified → échec).
        // On matérialise la liste AVANT le clear de Reconfigure (qui vide la même collection).
        var oldDimensions = model.Dimensions.ToList();
        db.Set<ShelterModelDimension>().RemoveRange(oldDimensions);

        model.Reconfigure(
            name: command.Name,
            categoryId: command.CategoryId,
            lengthStepCm: command.LengthStepCm,
            minLengthCm: command.MinLengthCm,
            maxLengthCm: command.MaxLengthCm,
            basePrice: command.BasePrice,
            pricePerArchCents: command.PricePerArchCents,
            widthsCm: command.WidthsCm,
            clearHeightsCm: command.ClearHeightsCm);

        db.Set<ShelterModelDimension>().AddRange(model.Dimensions.ToList());

        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(UpdateShelterModelCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
