using Domain.ValueObjects;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

public sealed class AddressTests
{
    [Fact]
    public void Create_NormalizesProvinceToUppercase()
    {
        var address = Address.Create("123", "rue Principale", null, "Montréal", "qc", "h2x1y3");

        address.Province.Should().Be("QC");
        address.PostalCode.Should().Be("H2X1Y3");
    }

    [Theory]
    [InlineData("", "rue Principale", "Montréal", "QC", "H2X1Y3")]   // numéro civique manquant
    [InlineData("123", "", "Montréal", "QC", "H2X1Y3")]              // rue manquante
    [InlineData("123", "rue Principale", "", "QC", "H2X1Y3")]        // ville manquante
    [InlineData("123", "rue Principale", "Montréal", "QC", "")]      // code postal manquant
    public void Create_WithMissingRequiredField_Throws(
        string civicNumber, string street, string city, string province, string postalCode)
    {
        var act = () => Address.Create(civicNumber, street, null, city, province, postalCode);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_TrimsWhitespace()
    {
        var address = Address.Create("  123  ", "  rue des Érables  ", "  4B  ", "  Montréal  ", "QC", "  H2X 1Y3  ");

        address.CivicNumber.Should().Be("123");
        address.Street.Should().Be("rue des Érables");
        address.Apartment.Should().Be("4B");
        address.City.Should().Be("Montréal");
    }

    [Fact]
    public void Create_BlankApartment_StoredAsNull()
    {
        var address = Address.Create("123", "rue des Érables", "   ", "Gatineau", "QC", "J8X1A1");

        address.Apartment.Should().BeNull();
    }

    [Fact]
    public void ToString_WithApartment_IncludesCivicNumberAndApartment()
    {
        var address = Address.Create("123", "rue des Érables", "4B", "Gatineau", "QC", "J8X1A1");

        address.ToString().Should().Be("123 rue des Érables, app. 4B, Gatineau (QC) J8X1A1, Canada");
    }

    [Fact]
    public void ToString_WithoutApartment_OmitsApartmentSegment()
    {
        var address = Address.Create("123", "rue des Érables", null, "Gatineau", "QC", "J8X1A1");

        address.ToString().Should().Be("123 rue des Érables, Gatineau (QC) J8X1A1, Canada");
    }
}
