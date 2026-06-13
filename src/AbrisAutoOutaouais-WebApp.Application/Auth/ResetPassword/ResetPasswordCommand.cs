using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.Application.Auth.ResetPassword;

/// <summary>
/// Réinitialise le mot de passe à partir du jeton reçu par courriel
/// (voir <see cref="ForgotPassword.ForgotPasswordCommand"/>).
/// Échec (jeton invalide/expiré) → Result.Failure, mappé en 400 par le contrôleur.
/// </summary>
public sealed record ResetPasswordCommand(
    string Email,
    string Token,
    string NewPassword,
    string ConfirmPassword) : ICommand<Result>;

public sealed class ResetPasswordCommandHandler(
    IIdentityService identityService) : ICommandHandler<ResetPasswordCommand, Result>
{
    // Contrat ICommandHandler — délègue à HandleAsync (appelé par le Dispatcher).
    public ValueTask<Result> Handle(ResetPasswordCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));

    public Task<Result> HandleAsync(
        ResetPasswordCommand command, CancellationToken cancellationToken = default)
        => identityService.ResetPasswordAsync(
            command.Email, command.Token, command.NewPassword, cancellationToken);
}
