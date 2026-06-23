using System.Security.Cryptography;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Services;

/// <summary>
/// Implémentation par défaut de <see cref="IPaymentReferenceGenerator"/> : encode des octets
/// CRYPTOGRAPHIQUEMENT aléatoires en base32 « Crockford » (sans I/L/O/U pour éviter toute confusion
/// à la lecture/saisie manuelle), préfixés <c>ABR-</c> pour identifier la référence dans le message
/// du virement. Service PUR et sans état — aucune collection consultée (pas de HashSet.Contains,
/// L-038), donc trivialement testable et déterministe dans sa forme (longueur, alphabet).
/// <para>
/// On hand-roll l'encodage base32 (quelques lignes) plutôt que d'ajouter une dépendance
/// (design-patterns §1) ; on garde en revanche <see cref="RandomNumberGenerator"/> du framework
/// pour l'aléa cryptographique (ne JAMAIS réimplémenter du crypto, design-patterns §1).
/// </para>
/// </summary>
public sealed class Base32PaymentReferenceGenerator : IPaymentReferenceGenerator
{
    // Alphabet Crockford base32 sans I, L, O, U (caractères ambigus à la saisie manuelle).
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    // 12 caractères base32 → 60 bits d'entropie : largement non devinable, et court à recopier.
    private const int Length = 12;

    public string Generate()
    {
        Span<char> chars = stackalloc char[Length];
        Span<byte> randomBytes = stackalloc byte[Length];
        RandomNumberGenerator.Fill(randomBytes);

        for (var i = 0; i < Length; i++)
            chars[i] = Alphabet[randomBytes[i] % Alphabet.Length];

        return $"ABR-{new string(chars)}";
    }
}
