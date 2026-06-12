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
