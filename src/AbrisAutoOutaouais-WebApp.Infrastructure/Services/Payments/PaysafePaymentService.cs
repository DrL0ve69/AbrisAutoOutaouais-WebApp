using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Payments.Common;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Payments;

/// <summary>
/// Adaptateur <see cref="IPaymentService"/> pour Paysafe (processeur canadien — Interac e-Transfer
/// + cartes). STUB KEYLESS, NON IMPLÉMENTÉ ET JAMAIS LE DÉFAUT : il existe uniquement pour
/// documenter le point d'extension Strategy/OCP du port de paiement (miroir de
/// <c>GooglePlacesService</c>/<c>RadarPlacesService</c>, livrés sans clé active).
/// <para>
/// L'intégration RÉELLE de Paysafe exige une clé API, un contrat marchand (et PCI-DSS pour les
/// cartes) avec des frais par transaction — donc un compte de facturation → <b>traité comme
/// PAYANT</b> par <c>.claude/rules/budget-free-tier.md</c>. Le vrai appel API REST n'est livré que
/// sous l'accord explicite du propriétaire. Tant que la clé est vide, la garde fail-fast de
/// <c>DependencyInjection</c> empêche au DÉMARRAGE de sélectionner ce fournisseur.
/// </para>
/// <para>
/// RÉSILIENCE : conformément au contrat <see cref="IPaymentService"/> (comme <c>IPlacesService</c>),
/// <see cref="InitiateAsync"/> et <see cref="GetStatusAsync"/> ne lèvent JAMAIS et n'effectuent
/// AUCUN appel réseau. <see cref="InitiateAsync"/> retourne des instructions qui annoncent
/// explicitement que l'adaptateur est un stub non activé ; <see cref="GetStatusAsync"/> reste
/// <see cref="PaymentStatus.Pending"/>.
/// </para>
/// </summary>
internal sealed class PaysafePaymentService : IPaymentService
{
    // Stub keyless : aucune option n'est nécessaire. La garde fail-fast au DÉMARRAGE
    // (DependencyInjection) lit la clé directement depuis la config, pas via ce service.

    public Task<PaymentInstructionsResult> InitiateAsync(
        string paymentReference, decimal amount, string customerEmail, CancellationToken ct = default)
    {
        var instructions =
            "STUB Paysafe — adaptateur de paiement NON IMPLÉMENTÉ et NON ACTIVÉ. Ce fournisseur " +
            "n'encaisse aucun paiement : il documente uniquement le point d'extension du port de " +
            "paiement. L'intégration réelle de Paysafe (Interac e-Transfer + cartes) exige une clé " +
            "API, un contrat marchand payant (PCI-DSS pour les cartes) et l'accord explicite du " +
            "propriétaire (règle budget). Le fournisseur par défaut reste le virement Interac " +
            "manuel (« manual »).";

        var result = new PaymentInstructionsResult(
            Reference: paymentReference,
            RecipientEmail: string.Empty,
            Amount: amount,
            Instructions: instructions);

        return Task.FromResult(result);
    }

    public Task<PaymentStatus> GetStatusAsync(string paymentReference, CancellationToken ct = default)
        => Task.FromResult(PaymentStatus.Pending);
}
