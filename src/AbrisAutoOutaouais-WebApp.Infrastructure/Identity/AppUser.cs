using Microsoft.AspNetCore.Identity;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Utilisateur de l'application — étend IdentityUser&lt;Guid&gt; directement.
/// Toutes les données du profil vivent ici : zéro table UserProfile séparée.
///
/// IdentityUser&lt;Guid&gt; fournit déjà :
///   Id, Email, NormalizedEmail, EmailConfirmed,
///   UserName, NormalizedUserName, PasswordHash,
///   PhoneNumber, PhoneNumberConfirmed,
///   SecurityStamp, ConcurrencyStamp,
///   TwoFactorEnabled, LockoutEnabled, LockoutEnd, AccessFailedCount.
/// </summary>
public sealed class AppUser : IdentityUser<Guid>
{
    // ── Profil ───────────────────────────────────────────────────────────────
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Avatar { get; set; }               // URL vers l'image stockée
    public string PreferredLanguage { get; set; } = "fr";      // "fr" | "en"

    // ── Adresse de livraison par défaut (Owned Entity) ────────────────────
    // Stockée dans AspNetUsers avec le préfixe "DefaultDeliveryAddress_"
    // Null si l'utilisateur n'a pas encore fourni d'adresse
    public DeliveryAddress? DefaultDeliveryAddress { get; set; }

    // ── Audit ────────────────────────────────────────────────────────────────
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // ── Navigations (non-FK — même DbContext, EF gère les relations) ─────────
    // Orders, RentalContracts, BookingSlots référencent AppUser.Id
    // On ne déclare pas les collections ici pour garder AppUser simple.
    // Utiliser .Include() dans les queries si besoin.

    // ── Helpers ──────────────────────────────────────────────────────────────
    public string FullName => $"{FirstName} {LastName}".Trim();
}
