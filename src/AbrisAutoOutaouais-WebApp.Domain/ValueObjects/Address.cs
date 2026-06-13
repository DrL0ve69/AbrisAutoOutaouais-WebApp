namespace Domain.ValueObjects;

/// <summary>
/// Adresse immuable — Owned Entity dans EF Core.
/// La table propriétaire reçoit des colonnes préfixées (ex: ShippingAddress_Street).
/// Le numéro civique (<see cref="CivicNumber"/>) et le nom de rue (<see cref="Street"/>) sont
/// stockés séparément ; <see cref="Apartment"/> (numéro d'appartement / unité) est optionnel.
/// </summary>
public sealed class Address
{
    public string CivicNumber { get; init; } = string.Empty;
    public string Street { get; init; } = string.Empty;
    public string? Apartment { get; init; }
    public string City { get; init; } = string.Empty;
    public string Province { get; init; } = "QC";
    public string PostalCode { get; init; } = string.Empty;
    public string Country { get; init; } = "Canada";

    private Address() { }  // EF Core

    public static Address Create(
        string civicNumber, string street, string? apartment,
        string city, string province, string postalCode,
        string country = "Canada")
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(civicNumber);
        ArgumentException.ThrowIfNullOrWhiteSpace(street);
        ArgumentException.ThrowIfNullOrWhiteSpace(city);
        ArgumentException.ThrowIfNullOrWhiteSpace(postalCode);

        var apt = string.IsNullOrWhiteSpace(apartment) ? null : apartment.Trim();

        return new Address
        {
            CivicNumber = civicNumber.Trim(),
            Street = street.Trim(),
            Apartment = apt,
            City = city.Trim(),
            Province = province.Trim().ToUpperInvariant(),
            PostalCode = postalCode.Trim().ToUpperInvariant(),
            Country = country.Trim(),
        };
    }

    public override string ToString()
    {
        var apt = Apartment is null ? string.Empty : $", app. {Apartment}";
        return $"{CivicNumber} {Street}{apt}, {City} ({Province}) {PostalCode}, {Country}";
    }
}
