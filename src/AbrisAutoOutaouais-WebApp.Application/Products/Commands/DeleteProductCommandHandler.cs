using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

/// <summary>
/// Charge le produit puis le retire du contexte. Le <c>SoftDeleteInterceptor</c> intercepte
/// la suppression et applique un soft-delete (<c>IsDeleted</c>).
/// <c>HandleAsync</c> contient la logique (appelé par le Dispatcher) ; <c>Handle</c> satisfait
/// le contrat <see cref="ICommandHandler{TCommand,TResult}"/> et délègue.
/// </summary>
public sealed class DeleteProductCommandHandler(IApplicationDbContext db)
    : ICommandHandler<DeleteProductCommand, bool>
{
    public async Task<bool> HandleAsync(DeleteProductCommand command, CancellationToken ct)
    {
        var product = await db.Products
            .FirstOrDefaultAsync(p => p.Id == command.Id, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.Product), command.Id);

        db.Products.Remove(product);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(DeleteProductCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
