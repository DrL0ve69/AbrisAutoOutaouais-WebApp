using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

/// <summary>Supprime un produit. Le <c>SoftDeleteInterceptor</c> transforme la suppression en soft-delete.</summary>
public sealed record DeleteProductCommand(Guid Id) : ICommand<bool>;
