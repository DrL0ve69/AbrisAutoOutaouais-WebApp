namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Owned Entity — stockée dans AspNetUsers, pas dans une table séparée.
/// Configurée via AppUserConfiguration.
/// </summary>
public sealed class DeliveryAddress
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Province { get; set; } = "QC";
    public string PostalCode { get; set; } = string.Empty;
    public string Country { get; set; } = "Canada";
}
