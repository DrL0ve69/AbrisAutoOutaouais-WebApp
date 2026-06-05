namespace AbrisAutoOutaouais_WebApp.Domain.Exceptions;

// On pourrait aussi séparer les exceptions en plusieurs classes (ex: NotFoundException, ConflictException, etc.) pour une meilleure granularité et gestion des erreurs.

/// <summary>→ HTTP 404</summary>
public sealed class NotFoundException(string name, object key)
    : Exception($"Ressource « {name} » avec la clé « {key} » introuvable.");

/// <summary>→ HTTP 409 (ex: slug déjà utilisé)</summary>
public sealed class ConflictException(string message)
    : Exception(message);

/// <summary>→ HTTP 403 (authentifié mais pas autorisé)</summary>
public sealed class ForbiddenException(string message)
    : Exception(message);

/// <summary>→ HTTP 422 (règle métier violée)</summary>
public sealed class BusinessRuleException(string message)
    : Exception(message);
