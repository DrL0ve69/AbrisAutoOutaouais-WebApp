using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CancelRental;

public sealed record CancelRentalCommand(Guid Id) : ICommand<bool>;

internal sealed class CancelRentalCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : ICommandHandler<CancelRentalCommand, bool>
{
    public async Task<bool> HandleAsync(CancelRentalCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        // L'utilisateur ne peut annuler que SES locations.
        var contract = await db.RentalContracts
            .FirstOrDefaultAsync(r => r.Id == cmd.Id && r.CustomerId == userId, ct)
            ?? throw new NotFoundException(nameof(RentalContract), cmd.Id);

        contract.Cancel(); // règle métier dans l'agrégat
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(CancelRentalCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
