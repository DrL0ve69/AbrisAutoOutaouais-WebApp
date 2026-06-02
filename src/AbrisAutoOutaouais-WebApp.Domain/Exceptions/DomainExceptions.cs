namespace AbrisAutoOutaouais_WebApp.Domain.Exceptions;

public sealed class NotFoundException(string name, object key)
    : Exception($"Ressource « {name} » avec la clé « {key} » introuvable.");

public sealed class ConflictException(string message)
    : Exception(message);

public sealed class ForbiddenException(string message)
    : Exception(message);

public sealed class BusinessRuleException(string message)
    : Exception(message);
