using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Domain.Entities;
using Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;

/// <summary>
/// Crée un <see cref="RentalContract"/> actif pour l'utilisateur courant.
/// <c>HandleAsync</c> est appelé par le Dispatcher ; <c>Handle</c> satisfait le contrat et délègue.
/// </summary>
internal sealed class CreateRentalContractCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : ICommandHandler<CreateRentalContractCommand, Guid>
{
    public async Task<Guid> HandleAsync(CreateRentalContractCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        var product = await db.Products
            .FirstOrDefaultAsync(p => p.Id == cmd.ProductId, ct)
            ?? throw new NotFoundException(nameof(Product), cmd.ProductId);

        var address = Address.Create(
            cmd.Address.Street,
            cmd.Address.City,
            string.IsNullOrWhiteSpace(cmd.Address.Province) ? "QC" : cmd.Address.Province,
            cmd.Address.PostalCode,
            string.IsNullOrWhiteSpace(cmd.Address.Country) ? "Canada" : cmd.Address.Country);

        // Règles métier (produit louable, dates cohérentes) dans RentalContract.Create()
        var contract = RentalContract.Create(userId, product, cmd.StartDate, cmd.EndDate, address);

        db.RentalContracts.Add(contract);
        await db.SaveChangesAsync(ct);

        return contract.Id;
    }

    public ValueTask<Guid> Handle(CreateRentalContractCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
