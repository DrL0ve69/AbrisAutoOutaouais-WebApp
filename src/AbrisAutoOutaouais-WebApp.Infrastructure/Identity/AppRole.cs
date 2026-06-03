using Microsoft.AspNetCore.Identity;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Rôle d'application — représente les rôles gérés par ASP.NET Core Identity.
/// </summary>
public sealed class AppRole : IdentityRole<Guid>
{
    public AppRole() { }
    public AppRole(string roleName) : base(roleName) { }

    public string? Description { get; set; }
}
