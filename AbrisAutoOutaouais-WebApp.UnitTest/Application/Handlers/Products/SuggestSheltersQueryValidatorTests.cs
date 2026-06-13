using AbrisAutoOutaouais_WebApp.Application.Products.Queries.SuggestShelters;
using AbrisAutoOutaouais_WebApp.Domain.Constants;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Products;

/// <summary>
/// Dimensions requises : strictement positives et ≤ MaxCm. 0, négatif et au-delà
/// de la borne haute sont rejetés (→ 422 par le pipeline) ; les valeurs dans la plage
/// passent.
/// </summary>
public sealed class SuggestSheltersQueryValidatorTests
{
    private readonly SuggestSheltersQueryValidator _validator = new();

    [Theory]
    [InlineData(0, 400)]
    [InlineData(-1, 400)]
    [InlineData(400, 0)]
    [InlineData(400, -10)]
    [InlineData(ProductDimensions.MaxCm + 1, 400)]
    [InlineData(400, ProductDimensions.MaxCm + 1)]
    public void Invalid_WhenOutOfRange(int width, int length)
    {
        var result = _validator.Validate(new SuggestSheltersQuery(width, length));

        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(1, 1)]                                          // bornes basses
    [InlineData(300, 400)]                                      // valeur usuelle
    [InlineData(ProductDimensions.MaxCm, ProductDimensions.MaxCm)]  // bornes hautes inclusives
    public void Valid_WhenWithinRange(int width, int length)
    {
        var result = _validator.Validate(new SuggestSheltersQuery(width, length));

        result.IsValid.Should().BeTrue();
    }
}
