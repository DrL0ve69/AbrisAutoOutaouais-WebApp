using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Middlewares;

/// <summary>
/// Mappe les exceptions Domain vers RFC 9457 ProblemDetails.
/// Enregistré via AddExceptionHandler&lt;T&gt; dans Program.cs.
/// Remplace les try/catch dans les controllers.
/// </summary>
internal sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken ct)
    {
        var (statusCode, title) = exception switch
        {
            NotFoundException => (404, "Ressource introuvable"),
            ConflictException => (409, "Conflit de données"),
            ForbiddenException => (403, "Accès refusé"),
            BusinessRuleException => (422, "Règle métier violée"),
            ValidationException => (422, "Données invalides"),
            UnauthorizedAccessException => (401, "Non authentifié"),
            _ => (500, "Erreur interne du serveur"),
        };

        if (statusCode == 500)
            logger.LogError(exception, "Erreur non gérée : {Message}", exception.Message);

        var detail = exception is ValidationException ve
            ? string.Join(" | ", ve.Errors.Select(e => e.ErrorMessage))
            : exception.Message;

        httpContext.Response.StatusCode = statusCode;

        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Extensions = { ["traceId"] = httpContext.TraceIdentifier },
        }, ct);

        return true;
    }
}
