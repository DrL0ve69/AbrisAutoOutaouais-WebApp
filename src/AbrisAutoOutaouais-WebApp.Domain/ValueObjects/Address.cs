namespace Domain.ValueObjects;

/// <summary>
/// Objet valeur immuable représentant une adresse de livraison ou d'installation.
/// Stocké comme Owned Entity dans EF Core (pas de table séparée, colonnes préfixées).
/// </summary>
public sealed class Address
{
    public string  Street     { get; init; } = string.Empty;
    public string  City       { get; init; } = string.Empty;
    public string  Province   { get; init; } = "QC";
    public string  PostalCode { get; init; } = string.Empty;
    public string  Country    { get; init; } = "Canada";

    // Validation légère dans le VO lui-même
    public static Address Create(string street, string city, string province, string postalCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(street);
        ArgumentException.ThrowIfNullOrWhiteSpace(city);
        ArgumentException.ThrowIfNullOrWhiteSpace(postalCode);

        return new Address
        {
            Street     = street.Trim(),
            City       = city.Trim(),
            Province   = province.Trim().ToUpperInvariant(),
            PostalCode = postalCode.Trim().ToUpperInvariant(),
        };
    }
}