using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

/// <summary>
/// Charge le produit (suivi), applique <see cref="Domain.Entities.Product.UpdateDetails"/>,
/// ajuste le stock vers la cible, puis sauvegarde.
/// <c>HandleAsync</c> contient la logique (appelé par le Dispatcher) ; <c>Handle</c> satisfait
/// le contrat <see cref="ICommandHandler{TCommand,TResult}"/> et délègue.
/// </summary>
public sealed class UpdateProductCommandHandler(IApplicationDbContext db)
    : ICommandHandler<UpdateProductCommand, bool>
{
    public async Task<bool> HandleAsync(UpdateProductCommand command, CancellationToken ct)
    {
        var product = await db.Products
            .FirstOrDefaultAsync(p => p.Id == command.Id, ct)
            ?? throw new NotFoundException(nameof(Domain.Entities.Product), command.Id);

        product.UpdateDetails(command.Name, command.Description, command.Price);
        product.AdjustStock(command.Stock - product.Stock);
        // Note : le changement de catégorie n'est pas appliqué — l'agrégat Product n'expose
        // pas de moyen de modifier CategoryId sans toucher au Domain.

        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(UpdateProductCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
