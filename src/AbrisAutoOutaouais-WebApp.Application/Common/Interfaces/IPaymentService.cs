using AbrisAutoOutaouais_WebApp.Application.Payments.Common;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Port (frontière Clean Architecture) vers un fournisseur de paiement. L'implémentation par défaut
/// (<c>ManualInteracPaymentService</c>) vit dans l'Infrastructure et peut être permutée par
/// configuration seule (<c>Payments:Provider</c> → manual / vopay / paysafe — même idiome que
/// <c>IPlacesService</c>). Aucun type Infra ne traverse cette frontière : seuls
/// <see cref="PaymentInstructionsResult"/>, <see cref="PaymentStatus"/> et des primitives circulent.
/// <para>
/// RÉSILIENCE : comme <c>IPlacesService</c>, ces méthodes ne lèvent JAMAIS d'exception réseau /
/// désérialisation — un fournisseur de paiement externe indisponible ne doit pas se traduire par un
/// 500 qui ferait échouer la création de la commande déjà persistée.
/// </para>
/// </summary>
public interface IPaymentService
{
    /// <summary>
    /// Initie un paiement pour la référence donnée et renvoie les instructions à présenter au client.
    /// Ne lève jamais : en cas d'échec d'un fournisseur externe, renvoie tout de même des instructions
    /// exploitables (l'implémentation manuelle, sans réseau, ne peut pas échouer).
    /// </summary>
    Task<PaymentInstructionsResult> InitiateAsync(
        string paymentReference, decimal amount, string customerEmail, CancellationToken ct = default);

    /// <summary>
    /// Renvoie le statut du paiement pour la référence donnée. Pour le virement Interac manuel, reste
    /// <see cref="PaymentStatus.Pending"/> : la confirmation passe par la réconciliation administrative
    /// (<c>Order.MarkPaid</c>), pas par une interrogation du fournisseur. Ne lève jamais.
    /// </summary>
    Task<PaymentStatus> GetStatusAsync(string paymentReference, CancellationToken ct = default);
}
