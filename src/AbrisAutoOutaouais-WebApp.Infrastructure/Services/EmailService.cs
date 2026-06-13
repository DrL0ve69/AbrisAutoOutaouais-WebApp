using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services;

/// <summary>
/// Implémentation de DÉVELOPPEMENT : journalise les courriels au lieu de les envoyer.
/// Le lien de réinitialisation apparaît dans la console de l'API, ce qui permet de
/// tester le parcours complet sans serveur SMTP. En production, remplacer par un
/// fournisseur réel (SMTP, SendGrid, Amazon SES…) derrière la même interface.
/// </summary>
internal sealed class EmailService(ILogger<EmailService> logger) : IEmailService
{
    public Task SendOrderConfirmationAsync(Guid orderId, string toEmail, CancellationToken ct = default)
        => LogAsync(toEmail, "Confirmation de commande",
            $"Votre commande {orderId} est confirmée. Merci de votre confiance !");

    public Task SendBookingConfirmationAsync(Guid bookingId, string toEmail, CancellationToken ct = default)
        => LogAsync(toEmail, "Confirmation de réservation",
            $"Votre réservation d'installation {bookingId} est confirmée.");

    public Task SendRentalContractAsync(Guid rentalId, string toEmail, CancellationToken ct = default)
        => LogAsync(toEmail, "Contrat de location",
            $"Votre contrat de location {rentalId} est prêt.");

    public Task SendPasswordResetAsync(string toEmail, string resetLink, CancellationToken ct = default)
        => LogAsync(toEmail, "Réinitialisation du mot de passe",
            $"Pour choisir un nouveau mot de passe, ouvrez ce lien : {resetLink} " +
            "(valide pour une durée limitée). Si vous n'êtes pas à l'origine de cette " +
            "demande, ignorez ce courriel.");

    // Journalise le courriel « envoyé » (destinataire + sujet + corps) au niveau Information.
    private Task LogAsync(string toEmail, string subject, string body)
    {
        logger.LogInformation(
            "Courriel simulé → {Destinataire} | Sujet : {Sujet} | Corps : {Corps}",
            toEmail, subject, body);
        return Task.CompletedTask;
    }
}
