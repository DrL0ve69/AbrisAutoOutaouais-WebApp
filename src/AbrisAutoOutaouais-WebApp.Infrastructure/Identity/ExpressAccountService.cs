using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.AspNetCore.Identity;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Trouve-ou-crée un « compte express » passwordless pour un visiteur non connecté, via
/// <see cref="UserManager{AppUser}"/>. Implémente le port <see cref="IExpressAccountService"/>.
///
/// Garanties de sécurité (déjà tranchées) :
/// <list type="bullet">
///   <item>Création SANS mot de passe → <c>PasswordHash == null</c> → le compte ne peut jamais se
///   connecter ; aucun JWT n'est émis ici (on ne renvoie qu'un <see cref="Guid"/>).</item>
///   <item>Courriel déjà connu (compte réel OU express) → on RÉUTILISE l'<c>Id</c> existant pour y
///   rattacher la commande, sans divulguer ni ouvrir de session.</item>
///   <item>Rôle figé à <see cref="Roles.Customer"/>.</item>
/// </list>
/// </summary>
public sealed class ExpressAccountService(UserManager<AppUser> userManager) : IExpressAccountService
{
    public async Task<Guid> FindOrCreateByEmailAsync(GuestContact contact, CancellationToken ct = default)
    {
        // Réutilisation : un compte (réel ou express) existe déjà pour ce courriel.
        var existing = await userManager.FindByEmailAsync(contact.Email);
        if (existing is not null)
            return existing.Id;

        var user = new AppUser
        {
            UserName = contact.Email,
            Email = contact.Email,
            FirstName = contact.FirstName,
            LastName = contact.LastName,
            PhoneNumber = contact.Phone,
            IsExpress = true,
            EmailConfirmed = false,
            CreatedAt = DateTime.UtcNow,
        };

        // Création SANS mot de passe : le compte reste passwordless (non connectable).
        var result = await userManager.CreateAsync(user);
        if (result.Succeeded)
        {
            await userManager.AddToRoleAsync(user, Roles.Customer);
            return user.Id;
        }

        // Idempotence en concurrence : si deux requêtes invité concurrentes créent le même courriel,
        // l'une échoue sur DuplicateUserName / DuplicateEmail. On relit alors le compte gagnant.
        var describer = new IdentityErrorDescriber();
        var duplicateCodes = new[]
        {
            describer.DuplicateUserName(contact.Email).Code,
            describer.DuplicateEmail(contact.Email).Code,
        };

        if (result.Errors.Any(e => duplicateCodes.Contains(e.Code)))
        {
            var winner = await userManager.FindByEmailAsync(contact.Email);
            if (winner is not null)
                return winner.Id;
        }

        var errors = string.Join(", ", result.Errors.Select(e => e.Description));
        throw new BusinessRuleException($"Création du compte express impossible : {errors}");
    }
}
