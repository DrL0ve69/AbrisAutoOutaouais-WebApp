namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services.Payments;

/// <summary>
/// Options du service de paiement, bindées sur la section <c>Payments</c> de la configuration
/// (même idiome options-bound que <c>PlacesOptions</c>). Le fournisseur actif est choisi par
/// <see cref="Provider"/> ; permuter manual → VoPay → Paysafe se fait par configuration seule.
/// <para>
/// Le défaut est le virement Interac MANUEL (<c>manual</c>) : voie gratuite et sans clé. Les
/// fournisseurs automatisés (VoPay / Paysafe) restent volontairement sans clé
/// (<c>ApiKey: ""</c>) tant que leurs adaptateurs ne sont pas livrés (sous-tâche 7.4).
/// </para>
/// </summary>
public sealed class PaymentsOptions
{
    /// <summary>« manual » (défaut, virement Interac sans clé) | « vopay » | « paysafe ».</summary>
    public string Provider { get; set; } = "manual";

    public ManualPaymentOptions Manual { get; set; } = new();
    public VoPayPaymentOptions VoPay { get; set; } = new();
    public PaysafePaymentOptions Paysafe { get; set; } = new();
}

/// <summary>Virement Interac manuel — sans clé. Le courriel marchand reçoit les virements.</summary>
public sealed class ManualPaymentOptions
{
    public string RecipientEmail { get; set; } = string.Empty;
}

/// <summary>VoPay (automatisé) — clé à fournir lors de la livraison de l'adaptateur (7.4).</summary>
public sealed class VoPayPaymentOptions
{
    public string ApiKey { get; set; } = string.Empty;
}

/// <summary>Paysafe (automatisé) — clé à fournir lors de la livraison de l'adaptateur (7.4).</summary>
public sealed class PaysafePaymentOptions
{
    public string ApiKey { get; set; } = string.Empty;
}
