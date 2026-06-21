using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.SuggestShelterModels;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Shelters.Queries;

/// <summary>
/// Dimensions requises : strictement positives et ≤ 2000 cm. 0, négatif et au-delà de la borne
/// haute → invalide (422 via le pipeline) ; valeurs dans la plage → valide.
/// </summary>
public sealed class SuggestShelterModelsQueryValidatorTests
{
    private readonly SuggestShelterModelsQueryValidator _validator = new();

    [Theory]
    [InlineData(0, 400)]
    [InlineData(-1, 400)]
    [InlineData(400, 0)]
    [InlineData(400, -10)]
    [InlineData(2001, 400)]
    [InlineData(400, 2001)]
    public void Invalid_WhenOutOfRange(int width, int length)
        => _validator.Validate(new SuggestShelterModelsQuery(width, length))
            .IsValid.Should().BeFalse();

    [Theory]
    [InlineData(1, 1)]
    [InlineData(914, 1219)]
    [InlineData(2000, 2000)]
    public void Valid_WhenWithinRange(int width, int length)
        => _validator.Validate(new SuggestShelterModelsQuery(width, length))
            .IsValid.Should().BeTrue();
}
