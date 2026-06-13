namespace AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;

/// <summary>Utilisateur vu par l'administration (GET /users).</summary>
public sealed record AdminUserDto(
    Guid Id,
    string Email,
    string Username,
    string FullName,
    IReadOnlyList<string> Roles,
    DateTime CreatedAt,
    bool IsLockedOut);
