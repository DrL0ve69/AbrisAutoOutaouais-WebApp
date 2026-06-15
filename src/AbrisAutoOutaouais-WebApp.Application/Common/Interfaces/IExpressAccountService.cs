using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Port (couche Application, zéro type Identity) qui trouve-ou-crée un « compte express »
/// passwordless rattaché par courriel pour un visiteur non connecté. L'implémentation vit dans
/// Infrastructure (<c>ExpressAccountService</c>) et s'appuie sur <c>UserManager</c>.
///
/// Sécurité : un compte express a <c>PasswordHash == null</c> → il ne peut JAMAIS se connecter ;
/// aucun chemin invité n'émet de session/JWT (les handlers ne renvoient qu'un <see cref="Guid"/>).
/// Si le courriel correspond déjà à un compte (réel OU express), on RÉUTILISE ce compte (on
/// rattache la commande), sans divulguer son existence ni ouvrir de session.
/// </summary>
public interface IExpressAccountService
{
    /// <summary>
    /// Renvoie l'<c>AppUser.Id</c> du compte associé au courriel du contact, en le créant en mode
    /// express (rôle <c>Customer</c>, sans mot de passe) s'il n'existe pas encore. Idempotent.
    /// </summary>
    Task<Guid> FindOrCreateByEmailAsync(GuestContact contact, CancellationToken ct = default);
}
