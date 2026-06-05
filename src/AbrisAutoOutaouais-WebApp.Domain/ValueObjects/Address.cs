namespace Domain.ValueObjects;

/// <summary>
/// Adresse immuable — Owned Entity dans EF Core.
/// La table propriétaire reçoit des colonnes préfixées (ex: ShippingAddress_Street).
/// </summary>
public sealed class Address
{
    public string Street { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public string Province { get; init; } = "QC";
    public string PostalCode { get; init; } = string.Empty;
    public string Country { get; init; } = "Canada";

    private Address() { }  // EF Core

    public static Address Create(
        string street, string city, string province, string postalCode,
        string country = "Canada")
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(street);
        ArgumentException.ThrowIfNullOrWhiteSpace(city);
        ArgumentException.ThrowIfNullOrWhiteSpace(postalCode);

        return new Address
        {
            Street = street.Trim(),
            City = city.Trim(),
            Province = province.Trim().ToUpperInvariant(),
            PostalCode = postalCode.Trim().ToUpperInvariant(),
            Country = country.Trim(),
        };
    }

    public override string ToString()
        => $"{Street}, {City} ({Province}) {PostalCode}, {Country}";
}