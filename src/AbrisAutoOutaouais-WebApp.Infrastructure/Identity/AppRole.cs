using Microsoft.AspNetCore.Identity;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Rôle d'application — représente les rôles gérés par ASP.NET Core Identity. Rôle étendu avec Guid comme PK (cohérence avec AppUser) et une description optionnelle.
/// </summary>
public sealed class AppRole : IdentityRole<Guid>
{
    public AppRole() { }
    public AppRole(string roleName) : base(roleName) { }

    public string? Description { get; set; }
}
