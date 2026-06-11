using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

public sealed class CreateProductCommandHandler(IApplicationDbContext db,
    IDateTimeProvider dateTimeProvider) : ICommandHandler<CreateProductCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateProductCommand command, CancellationToken ct)
    {
        // Vérifier que le produit n'existe pas déjà
        if (db.Products.Any(p => p.Name == command.Name))
        {
            throw new InvalidOperationException("Un produit avec ce nom existe déjà.");
        }

        db.Products.Add( Product.Create(
            name: command.Name,
            slug: command.Description,
            price: command.Price,
            stock: command.StockQuantity,
            categoryId: command.CategoryId,
            null,
            null
        ));
        await db.SaveChangesAsync(ct);

        return await ValueTask.FromResult(Guid.NewGuid());
    }
}
