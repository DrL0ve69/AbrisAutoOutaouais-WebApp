using Domain.ValueObjects;
using Microsoft.AspNetCore.Identity;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Utilisateur de l'application.
/// Étend IdentityUser&lt;Guid&gt; directement — ZÉRO table UserProfile/Customer séparée.
///
/// IdentityUser&lt;Guid&gt; fournit déjà :
///   Id, Email, NormalizedEmail, EmailConfirmed,
///   UserName, NormalizedUserName, PasswordHash,
///   PhoneNumber, PhoneNumberConfirmed,
///   SecurityStamp, ConcurrencyStamp,
///   TwoFactorEnabled, LockoutEnabled, LockoutEnd, AccessFailedCount.
///
/// Address vient de Domain.ValueObjects — Infrastructure peut référencer Domain ✅.
/// </summary>
public sealed class AppUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public string PreferredLanguage { get; set; } = "fr";

    /// <summary>
    /// Adresse de livraison par défaut sauvegardée par l'utilisateur.
    /// Owned Entity — colonnes préfixées "DefaultAddress_*" dans AspNetUsers.
    /// Utilisée pour pré-remplir le formulaire de commande.
    /// </summary>
    public Address? DefaultDeliveryAddress { get; set; }

    /// <summary>
    /// Compte « express » créé en silence pour un visiteur non connecté lors d'un achat / d'une
    /// location / d'une réservation. Un compte express est passwordless (<c>PasswordHash == null</c>)
    /// → il ne peut jamais se connecter, et sert uniquement à rattacher la commande à un
    /// <c>CustomerId</c> réel. Défaut <c>false</c> (compte normal).
    /// </summary>
    public bool IsExpress { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}
