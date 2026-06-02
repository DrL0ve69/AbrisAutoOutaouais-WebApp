using Microsoft.AspNetCore.Identity;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Rôle d'application — représente les rôles gérés par ASP.NET Core Identity.
/// </summary>
public sealed class AppRole : IdentityRole<Guid>
{
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
