using Domain.ValueObjects;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

public sealed class AddressTests
{
    [Fact]
    public void Create_NormalizesProvinceToUppercase()
    {
        var address = Address.Create("123 rue", "Montréal", "qc", "h2x1y3");

        address.Province.Should().Be("QC");
        address.PostalCode.Should().Be("H2X1Y3");
    }

    [Theory]
    [InlineData("", "Montréal", "QC", "H2X1Y3")]
    [InlineData("123 rue", "", "QC", "H2X1Y3")]
    [InlineData("123 rue", "Montréal", "QC", "")]
    public void Create_WithMissingRequiredField_Throws(
        string street, string city, string province, string postalCode)
    {
        var act = () => Address.Create(street, city, province, postalCode);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_TrimsWhitespace()
    {
        var address = Address.Create("  123 rue  ", "  Montréal  ", "QC", "  H2X 1Y3  ");

        address.Street.Should().Be("123 rue");
        address.City.Should().Be("Montréal");
    }
}
