using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.CancelOrder;

public sealed record CancelOrderCommand(Guid OrderId) : ICommand<bool>;

internal sealed class CancelOrderCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : ICommandHandler<CancelOrderCommand, bool>
{
    public async Task<bool> HandleAsync(CancelOrderCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.UserId ?? Guid.Empty;

        // L'utilisateur ne peut annuler que SES commandes.
        var order = await db.Orders
            .FirstOrDefaultAsync(o => o.Id == cmd.OrderId && o.CustomerId == userId, ct)
            ?? throw new NotFoundException(nameof(Order), cmd.OrderId);

        order.Cancel(); // règle métier dans l'agrégat
        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(CancelOrderCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
