namespace Domain.ValueObjects;

/// <summary>
/// Information de paiement portée par l'agrégat <c>Order</c> (Owned Entity EF Core, colonnes
/// préfixées <c>Payment_*</c>). Le statut de paiement vit sur l'agrégat — il N'Y A PAS d'entité
/// <c>Payment</c> séparée pour le MVP.
/// <para>
/// <see cref="Reference"/> est la référence de paiement NON DEVINABLE communiquée au client pour
/// la saisie du virement Interac (e-Transfer) ; <see cref="ConfirmedAt"/> est null tant que le
/// paiement n'est pas réconcilié par l'administration (qui appelle <c>Order.MarkPaid</c>).
/// </para>
/// Immuable comme <see cref="Address"/> : <see cref="Confirm"/> renvoie un NOUVEAU VO plutôt que
/// de muter l'instance.
/// </summary>
public sealed class PaymentInfo
{
    public string Reference { get; init; } = string.Empty;
    public DateTime? ConfirmedAt { get; init; }

    private PaymentInfo() { }  // EF Core

    /// <summary>
    /// Crée une information de paiement EN ATTENTE (référence émise, pas encore confirmée).
    /// </summary>
    public static PaymentInfo Pending(string reference)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reference);
        return new PaymentInfo { Reference = reference.Trim(), ConfirmedAt = null };
    }

    /// <summary>
    /// Renvoie un NOUVEAU VO marqué confirmé à l'instant <paramref name="nowUtc"/> (conserve la
    /// référence). VO immuable : on ne mute pas l'instance.
    /// </summary>
    public PaymentInfo Confirm(DateTime nowUtc)
        => new() { Reference = Reference, ConfirmedAt = nowUtc };
}
