using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Application.Orders.Commands.UpdateOrderStatus;

/// <summary>Corps de l'endpoint admin POST /orders/{id}/status.</summary>
public sealed record UpdateOrderStatusRequest(string Action);

/// <summary>Fait avancer (ou annule) le statut d'une commande — action métier de l'agrégat <see cref="Order"/>.</summary>
public sealed record UpdateOrderStatusCommand(Guid OrderId, string Action) : ICommand<bool>;

internal sealed class UpdateOrderStatusCommandHandler(IApplicationDbContext db)
    : ICommandHandler<UpdateOrderStatusCommand, bool>
{
    public async Task<bool> HandleAsync(UpdateOrderStatusCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders
            .FirstOrDefaultAsync(o => o.Id == cmd.OrderId, ct)
            ?? throw new NotFoundException(nameof(Order), cmd.OrderId);

        switch (cmd.Action?.Trim().ToLowerInvariant())
        {
            case "confirm": order.Confirm(); break;
            case "ship": order.Ship(); break;
            case "deliver": order.Deliver(); break;
            case "cancel": order.Cancel(); break;
            default:
                throw new BusinessRuleException($"Action de commande inconnue : « {cmd.Action} ».");
        }

        await db.SaveChangesAsync(ct);
        return true;
    }

    public ValueTask<bool> Handle(UpdateOrderStatusCommand cmd, CancellationToken ct)
        => new(HandleAsync(cmd, ct));
}
