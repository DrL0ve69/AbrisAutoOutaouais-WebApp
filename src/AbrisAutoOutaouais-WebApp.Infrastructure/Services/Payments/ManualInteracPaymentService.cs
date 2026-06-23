using System.Globalization;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Payments.Common;
using Microsoft.Extensions.Options;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Payments;

/// <summary>
/// Implémentation par défaut du port <see cref="IPaymentService"/> : virement Interac (e-Transfer)
/// MANUEL. Provider actif quand <c>Payments:Provider = "manual"</c>. Voie GRATUITE et SANS CLÉ — aucun
/// appel réseau, aucune dépendance externe (cf. règle budget).
/// <para>
/// <see cref="InitiateAsync"/> compose les instructions de virement (courriel marchand depuis les
/// options + référence + montant + texte d'instruction) au FORMAT CANONIQUE attendu par l'Application
/// (L-004 / L-011). Sans réseau, la méthode ne peut pas échouer.
/// </para>
/// <para>
/// <see cref="GetStatusAsync"/> renvoie toujours <see cref="PaymentStatus.Pending"/> : la confirmation
/// d'un virement manuel ne s'obtient pas par interrogation d'un fournisseur, mais par la réconciliation
/// administrative (<c>Order.MarkPaid</c> via l'endpoint confirm-payment).
/// </para>
/// </summary>
internal sealed class ManualInteracPaymentService(IOptions<PaymentsOptions> options) : IPaymentService
{
    private readonly ManualPaymentOptions _manual = options.Value.Manual;

    public Task<PaymentInstructionsResult> InitiateAsync(
        string paymentReference, decimal amount, string customerEmail, CancellationToken ct = default)
    {
        var recipient = _manual.RecipientEmail;
        var amountText = amount.ToString("C2", CultureInfo.GetCultureInfo("fr-CA"));

        var instructions =
            $"Pour régler votre commande, faites un virement Interac de {amountText} à l'adresse " +
            $"courriel {recipient}. Inscrivez la référence {paymentReference} dans le message du " +
            $"virement afin que nous puissions associer votre paiement à votre commande. Votre commande " +
            $"sera confirmée dès la réception du virement.";

        var result = new PaymentInstructionsResult(
            Reference: paymentReference,
            RecipientEmail: recipient,
            Amount: amount,
            Instructions: instructions);

        return Task.FromResult(result);
    }

    public Task<PaymentStatus> GetStatusAsync(string paymentReference, CancellationToken ct = default)
        => Task.FromResult(PaymentStatus.Pending);
}
