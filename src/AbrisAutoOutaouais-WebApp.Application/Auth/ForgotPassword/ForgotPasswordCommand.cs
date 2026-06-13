using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Auth.ForgotPassword;

/// <summary>
/// Demande d'envoi d'un lien de réinitialisation du mot de passe.
/// Réussit TOUJOURS (anti-énumération de comptes) : si aucun compte ne
/// correspond au courriel, aucun courriel n'est envoyé mais la réponse est
/// identique à celle d'un compte existant.
/// </summary>
public sealed record ForgotPasswordCommand(string Email) : ICommand<Unit>;

public sealed class ForgotPasswordCommandHandler(
    IIdentityService identityService,
    IEmailService emailService,
    IClientUrlProvider clientUrl) : ICommandHandler<ForgotPasswordCommand, Unit>
{
    // Contrat ICommandHandler — délègue à HandleAsync (appelé par le Dispatcher).
    public ValueTask<Unit> Handle(ForgotPasswordCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));

    public async Task<Unit> HandleAsync(
        ForgotPasswordCommand command, CancellationToken cancellationToken = default)
    {
        // ASSOMPTION DE SÉCURITÉ À ÉPINGLER (cf. L-007) : l'anti-énumération repose
        // ici UNIQUEMENT sur un corps de réponse identique (toujours 202). Or le
        // chemin « compte connu » fait génération de jeton + envoi de courriel de
        // façon SYNCHRONE avant de répondre, tandis que le chemin « compte inconnu »
        // sort tout de suite. Avec le stub actuel (journalisation ~instantanée)
        // l'écart de temps est négligeable, mais dès qu'un VRAI fournisseur SMTP est
        // branché, l'envoi (dizaines/centaines de ms) crée un oracle temporel : un
        // attaquant déduit l'existence d'un compte en chronométrant la réponse.
        // À ce moment-là, déplacer l'envoi HORS du chemin de requête (file d'attente
        // / fire-and-forget) pour que le temps de réponse soit indépendant de
        // l'existence du compte.
        var tokenResult = await identityService.GeneratePasswordResetTokenAsync(
            command.Email, cancellationToken);

        // Compte inconnu → no-op silencieux : ne jamais révéler l'existence d'un compte.
        if (!tokenResult.IsSuccess) return Unit.Value;

        // Le jeton Identity contient des caractères non sûrs en URL (+, /, =) :
        // Uri.EscapeDataString est obligatoire pour que le lien reste valide.
        var resetLink = $"{clientUrl.BaseUrl}/auth/reset" +
            $"?email={Uri.EscapeDataString(command.Email)}" +
            $"&token={Uri.EscapeDataString(tokenResult.Value!)}";

        await emailService.SendPasswordResetAsync(command.Email, resetLink, cancellationToken);
        return Unit.Value;
    }
}
