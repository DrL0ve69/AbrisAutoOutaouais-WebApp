using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

/// <summary>
/// Crée un produit. Génère un slug URL-friendly à partir du nom, vérifie l'unicité,
/// et retourne l'identifiant réel du produit créé.
/// <c>HandleAsync</c> contient la logique (appelé par le Dispatcher) ; <c>Handle</c> satisfait
/// le contrat <see cref="ICommandHandler{TCommand,TResult}"/> et délègue.
/// </summary>
public sealed class CreateProductCommandHandler(IApplicationDbContext db)
    : ICommandHandler<CreateProductCommand, Guid>
{
    public async Task<Guid> HandleAsync(CreateProductCommand command, CancellationToken ct)
    {
        var slug = GenerateSlug(command.Name);

        var exists = await db.Products
            .AnyAsync(p => p.Name == command.Name || p.Slug == slug, ct);
        if (exists)
            throw new ConflictException($"Un produit « {command.Name} » existe déjà.");

        var product = Product.Create(
            name: command.Name,
            slug: slug,
            price: command.Price,
            stock: command.StockQuantity,
            categoryId: command.CategoryId,
            description: command.Description);

        db.Products.Add(product);
        await db.SaveChangesAsync(ct);

        return product.Id;
    }

    public ValueTask<Guid> Handle(CreateProductCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));

    /// <summary>Slug minuscule sans accents : « Abri double à pic » → « abri-double-a-pic ».</summary>
    private static string GenerateSlug(string name)
    {
        var decomposed = name.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        var ascii = sb.ToString().Normalize(NormalizationForm.FormC);
        return Regex.Replace(ascii, "[^a-z0-9]+", "-").Trim('-');
    }
}
