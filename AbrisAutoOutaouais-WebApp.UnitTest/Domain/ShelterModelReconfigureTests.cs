using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Tests des invariants et de l'effet de <see cref="ShelterModel.Reconfigure"/> (EPIC 9.5) :
/// mêmes gardes que <c>Create</c>, remplacement EN BLOC de la collection owned, slug IMMUABLE.
/// </summary>
public sealed class ShelterModelReconfigureTests
{
    private static ShelterModel CreateValid(IReadOnlyList<int>? widths = null)
        => ShelterModel.Create(
            "abri-edit", "Abri à éditer", Guid.NewGuid(),
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            basePrice: 349.00m, pricePerArchCents: 15000,
            widthsCm: widths ?? [244], clearHeightsCm: [198]);

    [Fact]
    public void Reconfigure_WithValidData_UpdatesScalarsAndKeepsSlug()
    {
        var model = CreateValid();
        var newCategoryId = Guid.NewGuid();

        model.Reconfigure(
            name: "  Abri reconfiguré  ",
            categoryId: newCategoryId,
            lengthStepCm: 100,
            minLengthCm: 200,
            maxLengthCm: 1000,
            basePrice: 599.00m,
            pricePerArchCents: 22000,
            widthsCm: [305, 366],
            clearHeightsCm: [213]);

        model.Slug.Should().Be("abri-edit");           // slug INCHANGÉ
        model.Name.Should().Be("Abri reconfiguré");    // trimé
        model.CategoryId.Should().Be(newCategoryId);
        model.LengthStepCm.Should().Be(100);
        model.MinLengthCm.Should().Be(200);
        model.MaxLengthCm.Should().Be(1000);
        model.BasePrice.Should().Be(599.00m);
        model.PricePerArchCents.Should().Be(22000);
    }

    [Fact]
    public void Reconfigure_ReplacesDimensionsCollectionInBlock()
    {
        var model = CreateValid(widths: [244]);
        model.WidthOptionsCm.Should().Equal(244);

        model.Reconfigure(
            name: "Abri à éditer", categoryId: Guid.NewGuid(),
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            basePrice: 349.00m, pricePerArchCents: 15000,
            widthsCm: [305, 366], clearHeightsCm: [213]);

        // L'ancienne largeur 244 a disparu, remplacée en bloc.
        model.WidthOptionsCm.Should().Equal(305, 366);
        model.ClearHeightOptionsCm.Should().Equal(213);
    }

    [Fact]
    public void Reconfigure_WithMinGreaterOrEqualMax_Throws()
    {
        var model = CreateValid();
        var act = () => model.Reconfigure(
            "Abri", Guid.NewGuid(), 122, 1830, 1830, 349m, 15000, [244], [198]);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Reconfigure_WithMisalignedStep_Throws()
    {
        var model = CreateValid();
        // (1000 - 122) % 122 != 0 → désaligné
        var act = () => model.Reconfigure(
            "Abri", Guid.NewGuid(), 122, 122, 1000, 349m, 15000, [244], [198]);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Reconfigure_WithNoWidth_Throws()
    {
        var model = CreateValid();
        var act = () => model.Reconfigure(
            "Abri", Guid.NewGuid(), 122, 122, 1830, 349m, 15000, [], [198]);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Reconfigure_WithNoClearHeight_Throws()
    {
        var model = CreateValid();
        var act = () => model.Reconfigure(
            "Abri", Guid.NewGuid(), 122, 122, 1830, 349m, 15000, [244], []);
        act.Should().Throw<ArgumentException>();
    }
}
