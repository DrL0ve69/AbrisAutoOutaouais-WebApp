using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.DependencyInjection;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>
/// Dispatcher Mediator maison — résolution via IServiceProvider.
/// Scrutor enregistre automatiquement tous les handlers dans DependencyInjection.cs.
/// La validation FluentValidation s'exécute avant chaque handler dispatché
/// (<see cref="DispatchAsync{TResult}(ICommand{TResult}, CancellationToken)"/>) :
/// une requête invalide lève <see cref="ValidationException"/> (→ 422) avant
/// d'atteindre le handler ou le domaine.
/// </summary>
public sealed class Dispatcher(IServiceProvider sp): IDispatcher
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

    // ── Gestion des Commands (Task) ───────────────────────────────────────────
    public async Task<TResult> DispatchAsync<TResult>(ICommand<TResult> command, CancellationToken cancellationToken = default)
    {
        await ValidateAsync(command, cancellationToken);

        var handlerType = typeof(ICommandHandler<,>)
            .MakeGenericType(command.GetType(), typeof(TResult));
        dynamic handler = sp.GetRequiredService(handlerType);

        // On appelle explicitement HandleAsync qui retourne un Task
        return await handler.HandleAsync((dynamic)command, cancellationToken);
    }

    // ── Gestion des Queries (Task) ────────────────────────────────────────────
    public async Task<TResult> DispatchAsync<TResult>(IQuery<TResult> query, CancellationToken cancellationToken = default)
    {
        await ValidateAsync(query, cancellationToken);

        var handlerType = typeof(IQueryHandler<,>)
            .MakeGenericType(query.GetType(), typeof(TResult));
        dynamic handler = sp.GetRequiredService(handlerType);

        // On appelle explicitement HandleAsync qui retourne un Task
        return await handler.HandleAsync((dynamic)query, cancellationToken);
    }

    /// <summary>
    /// Exécute tous les <see cref="IValidator{T}"/> enregistrés pour le type de
    /// requête. Sans validateur, c'est un no-op. Lève <see cref="ValidationException"/>
    /// agrégée si au moins une règle échoue.
    /// </summary>
    private async Task ValidateAsync(object request, CancellationToken ct)
    {
        var requestType = request.GetType();
        var validatorType = typeof(IValidator<>).MakeGenericType(requestType);

        var validators = sp.GetServices(validatorType).OfType<IValidator>().ToList();
        if (validators.Count == 0) return;

        var contextType = typeof(ValidationContext<>).MakeGenericType(requestType);
        var context = (IValidationContext)Activator.CreateInstance(contextType, request)!;

        var failures = new List<ValidationFailure>();
        foreach (var validator in validators)
        {
            var result = await validator.ValidateAsync(context, ct);
            failures.AddRange(result.Errors);
        }

        if (failures.Count != 0)
            throw new ValidationException(failures);
    }
}
