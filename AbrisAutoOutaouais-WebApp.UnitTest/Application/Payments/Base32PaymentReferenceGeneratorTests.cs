using AbrisAutoOutaouais_WebApp.Application.Common.Services;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Payments;

/// <summary>
/// Générateur de référence de paiement : non vide, longueur/format stables, et unicité sur un grand
/// nombre de tirages (l'aléa cryptographique rend la référence non devinable). Service PUR.
/// </summary>
public sealed class Base32PaymentReferenceGeneratorTests
{
    private readonly Base32PaymentReferenceGenerator _sut = new();

    [Fact]
    public void Generate_ReturnsNonEmptyPrefixedReference()
    {
        var reference = _sut.Generate();

        reference.Should().NotBeNullOrWhiteSpace();
        reference.Should().StartWith("ABR-");
        // « ABR- » (4) + 12 caractères base32.
        reference.Should().HaveLength(16);
    }

    [Fact]
    public void Generate_UsesOnlyCrockfordBase32Alphabet_NoAmbiguousChars()
    {
        var body = _sut.Generate()["ABR-".Length..];

        // Alphabet sans I, L, O, U (caractères ambigus à la saisie manuelle).
        body.Should().MatchRegex("^[0-9A-HJKMNP-TV-Z]+$");
    }

    [Fact]
    public void Generate_OverManyDraws_ProducesUniqueReferences()
    {
        const int draws = 10_000;
        var seen = new HashSet<string>(draws);

        for (var i = 0; i < draws; i++)
            seen.Add(_sut.Generate());

        // 60 bits d'entropie : aucune collision attendue sur 10 000 tirages.
        seen.Should().HaveCount(draws);
    }
}
