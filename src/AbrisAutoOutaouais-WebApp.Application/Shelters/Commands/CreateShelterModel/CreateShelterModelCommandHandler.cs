using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.CreateShelterModel;

/// <summary>
/// Crée un modèle d'abri paramétrique : vérifie l'unicité du slug (sur lignes NON supprimées,
/// le filtre soft-delete global s'appliquant déjà) et l'existence de la catégorie, puis persiste.
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class CreateShelterModelCommandHandler(IApplicationDbContext db)
    : ICommandHandler<CreateShelterModelCommand, Guid>
{
    public async Task<Guid> HandleAsync(CreateShelterModelCommand command, CancellationToken ct)
    {
        // Normalise le slug comme le domaine pour comparer/conflit sur la forme canonique.
        var normalizedSlug = command.Slug.Trim().ToLowerInvariant();

        var slugTaken = await db.ShelterModels.AnyAsync(m => m.Slug == normalizedSlug, ct);
        if (slugTaken)
            throw new ConflictException($"Un modèle d'abri « {normalizedSlug} » existe déjà.");

        var categoryExists = await db.ProductCategories
            .AnyAsync(c => c.Id == command.CategoryId, ct);
        if (!categoryExists)
            throw new NotFoundException(nameof(ProductCategory), command.CategoryId);

        var model = ShelterModel.Create(
            slug: normalizedSlug,
            name: command.Name,
            categoryId: command.CategoryId,
            lengthStepCm: command.LengthStepCm,
            minLengthCm: command.MinLengthCm,
            maxLengthCm: command.MaxLengthCm,
            basePrice: command.BasePrice,
            pricePerArchCents: command.PricePerArchCents,
            widthsCm: command.WidthsCm,
            clearHeightsCm: command.ClearHeightsCm);

        db.ShelterModels.Add(model);
        await db.SaveChangesAsync(ct);

        return model.Id;
    }

    public ValueTask<Guid> Handle(CreateShelterModelCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
