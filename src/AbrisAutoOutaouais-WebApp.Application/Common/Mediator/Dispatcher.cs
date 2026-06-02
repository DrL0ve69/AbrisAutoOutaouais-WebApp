using Microsoft.Extensions.DependencyInjection;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>
/// Implémentation simple du Dispatcher CQRS.
/// </summary>
public sealed class Dispatcher : IDispatcher
{
    private readonly IServiceProvider _serviceProvider;

    public Dispatcher(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<TResult> DispatchAsync<TResult>(
        ICommand<TResult> command,
        CancellationToken cancellationToken = default)
    {
        var commandType = command.GetType();
        var handlerType = typeof(ICommandHandler<,>).MakeGenericType(commandType, typeof(TResult));
        var handler = _serviceProvider.GetService(handlerType)
            ?? throw new InvalidOperationException($"No handler found for command {commandType.Name}");

        var method = handlerType.GetMethod("HandleAsync")
            ?? throw new InvalidOperationException($"Handler {handlerType.Name} has no HandleAsync method");

        var result = await (Task<TResult>)method.Invoke(handler, [command, cancellationToken])!;
        return result;
    }

    public async Task<TResult> DispatchAsync<TResult>(
        IQuery<TResult> query,
        CancellationToken cancellationToken = default)
    {
        var queryType = query.GetType();
        var handlerType = typeof(IQueryHandler<,>).MakeGenericType(queryType, typeof(TResult));
        var handler = _serviceProvider.GetService(handlerType)
            ?? throw new InvalidOperationException($"No handler found for query {queryType.Name}");

        var method = handlerType.GetMethod("HandleAsync")
            ?? throw new InvalidOperationException($"Handler {handlerType.Name} has no HandleAsync method");

        var result = await (Task<TResult>)method.Invoke(handler, [query, cancellationToken])!;
        return result;
    }
}
