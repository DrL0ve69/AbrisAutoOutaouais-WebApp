namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>
/// Marque une commande CQRS.
/// </summary>
public interface ICommand<TResult>
{
}

/// <summary>
/// Marque une query CQRS.
/// </summary>
public interface IQuery<TResult>
{
}

/// <summary>
/// Gestionnaire de commande.
/// </summary>
public interface ICommandHandler<in TCommand, TResult> where TCommand : ICommand<TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken cancellationToken = default);
}

/// <summary>
/// Gestionnaire de query.
/// </summary>
public interface IQueryHandler<in TQuery, TResult> where TQuery : IQuery<TResult>
{
    Task<TResult> HandleAsync(TQuery query, CancellationToken cancellationToken = default);
}

/// <summary>
/// Dispatcher CQRS simplifié.
/// </summary>
public interface IDispatcher
{
    Task<TResult> DispatchAsync<TResult>(ICommand<TResult> command, CancellationToken cancellationToken = default);
    Task<TResult> DispatchAsync<TResult>(IQuery<TResult> query, CancellationToken cancellationToken = default);
}
