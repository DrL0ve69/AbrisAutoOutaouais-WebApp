using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.AdminCancelRental;

/// <summary>
/// Annulation d'un contrat de location par l'administration — contrairement à
/// <see cref="CancelRental.CancelRentalCommand"/>, AUCUNE vérification de propriété :
/// l'accès est restreint par la politique « AdminOnly » au niveau du contrôleur.
/// </summary>
public sealed record AdminCancelRentalCommand(Guid Id) : ICommand<bool>;

internal sealed class AdminCancelRentalCommandHandler(IApplicationDbContext db)
    : ICommandHandler<AdminCancelRentalCommand, bool>
{
    public async Task<bool> HandleAsync(AdminCancelRentalCommand cmd, CancellationToken ct)
    {
        var contract = await db.RentalContracts
            .FirstOrDefaultAsync(r => r.Id == cmd.Id, ct)
            ?? throw new NotFoundException(nameof(RentalContract), cmd.Id);

        contract.Cancel(); // règle métier dans l'agrégat (422 si déjà annulé/expiré)
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(AdminCancelRentalCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
