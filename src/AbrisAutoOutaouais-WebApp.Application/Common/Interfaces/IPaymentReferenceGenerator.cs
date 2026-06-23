namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Génère une référence de paiement NON DEVINABLE, lisible par un humain pour la saisie manuelle
/// dans le message d'un virement Interac (e-Transfer). Abstraction (port) pour rester testable et
/// injectable — l'implémentation par défaut (<c>Base32PaymentReferenceGenerator</c>) tire des octets
/// cryptographiquement aléatoires.
/// </summary>
public interface IPaymentReferenceGenerator
{
    /// <summary>Renvoie une nouvelle référence (ex. base32 ~12 caractères, sans caractères ambigus).</summary>
    string Generate();
}
