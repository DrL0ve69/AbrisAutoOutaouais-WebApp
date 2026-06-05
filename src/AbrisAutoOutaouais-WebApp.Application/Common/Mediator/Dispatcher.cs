using Microsoft.Extensions.DependencyInjection;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>
/// Dispatcher Mediator maison — résolution via IServiceProvider.
/// Scrutor enregistre automatiquement tous les handlers dans DependencyInjection.cs.
/// </summary>
public sealed class Dispatcher(IServiceProvider sp)
{
    public ValueTask<TResult> Send<TResult>(
        ICommand<TResult> command, CancellationToken ct = default)
    {
        var handlerType = typeof(ICommandHandler<,>)
            .MakeGenericType(command.GetType(), typeof(TResult));
        dynamic handler = sp.GetRequiredService(handlerType);
        return handler.Handle((dynamic)command, ct);
    }

    public ValueTask<TResult> Query<TResult>(
        IQuery<TResult> query, CancellationToken ct = default)
    {
        var handlerType = typeof(IQueryHandler<,>)
            .MakeGenericType(query.GetType(), typeof(TResult));
        dynamic handler = sp.GetRequiredService(handlerType);
        return handler.Handle((dynamic)query, ct);
    }
}
