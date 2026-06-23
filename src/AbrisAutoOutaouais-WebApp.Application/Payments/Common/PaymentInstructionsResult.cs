namespace AbrisAutoOutaouais_WebApp.Application.Payments.Common;

/// <summary>
/// Instructions de paiement renvoyées au client à la création de la commande. Format CANONIQUE
/// UNIQUE côté serveur (L-004) : tous les adaptateurs de <c>IPaymentService</c> émettent cette même
/// forme, quel que soit le fournisseur actif (manual / VoPay / Paysafe).
/// <para>
/// <see cref="Reference"/> est la référence à inscrire dans le message du virement Interac ;
/// <see cref="RecipientEmail"/> est le courriel marchand vers lequel envoyer le virement ;
/// <see cref="Amount"/> est le montant à payer ; <see cref="Instructions"/> est le texte
/// d'instructions (français) affiché au client.
/// </para>
/// </summary>
public sealed record PaymentInstructionsResult(
    string Reference,
    string RecipientEmail,
    decimal Amount,
    string Instructions);

/// <summary>
/// Statut d'un paiement vu côté fournisseur. Le virement Interac manuel reste
/// <see cref="Pending"/> jusqu'à la réconciliation par l'administration ; un fournisseur
/// automatisé (sous-tâche 7.4) pourra renvoyer <see cref="Confirmed"/>.
/// </summary>
public enum PaymentStatus
{
    Pending,
    Confirmed,
}
