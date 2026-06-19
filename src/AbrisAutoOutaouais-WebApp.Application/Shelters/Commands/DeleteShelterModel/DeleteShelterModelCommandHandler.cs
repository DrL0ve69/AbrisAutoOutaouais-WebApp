using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.DeleteShelterModel;

/// <summary>
/// Charge le modèle puis le retire du contexte. Le <c>SoftDeleteInterceptor</c> intercepte la
/// suppression et applique un soft-delete (<c>IsDeleted</c>).
/// <c>HandleAsync</c> porte la logique ; <c>Handle</c> satisfait l'interface et délègue.
/// </summary>
public sealed class DeleteShelterModelCommandHandler(IApplicationDbContext db)
    : ICommandHandler<DeleteShelterModelCommand, bool>
{
    public async Task<bool> HandleAsync(DeleteShelterModelCommand command, CancellationToken ct)
    {
        var model = await db.ShelterModels
            .FirstOrDefaultAsync(m => m.Id == command.Id, ct)
            ?? throw new NotFoundException(nameof(ShelterModel), command.Id);

        db.ShelterModels.Remove(model);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(DeleteShelterModelCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
