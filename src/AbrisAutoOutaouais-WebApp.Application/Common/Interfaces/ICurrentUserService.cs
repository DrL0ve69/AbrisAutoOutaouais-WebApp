namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Service pour accéder aux infos de l'utilisateur actuel (depuis le JWT).
/// </summary>
public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
    IReadOnlyList<string> Roles { get; }
    bool IsAuthenticated { get; }
    bool IsInRole(string role);
}
