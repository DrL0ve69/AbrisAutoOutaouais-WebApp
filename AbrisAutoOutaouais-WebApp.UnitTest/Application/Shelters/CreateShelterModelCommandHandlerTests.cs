using AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.CreateShelterModel;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Shelters;

public sealed class CreateShelterModelCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    private async Task<Guid> SeedCategoryAsync()
    {
        var cat = ProductCategory.Create("Abris autos", "abris-autos");
        _db.ProductCategories.Add(cat);
        await _db.SaveChangesAsync();
        return cat.Id;
    }

    private CreateShelterModelCommand ValidCommand(Guid categoryId, string slug = "abri-test")
        => new(
            Slug: slug, Name: "Abri test", CategoryId: categoryId,
            LengthStepCm: 122, MinLengthCm: 122, MaxLengthCm: 1830,
            WidthsCm: [335, 366], ClearHeightsCm: [198]);

    [Fact]
    public async Task Handle_WithValidCommand_PersistsAndReturnsId()
    {
        var catId = await SeedCategoryAsync();
        var handler = new CreateShelterModelCommandHandler(_db);

        var id = await handler.Handle(ValidCommand(catId), CancellationToken.None);

        id.Should().NotBeEmpty();
        var saved = await _db.ShelterModels.FindAsync(id);
        saved.Should().NotBeNull();
        saved!.Slug.Should().Be("abri-test");
        saved.WidthOptionsCm.Should().Equal(335, 366);
    }

    [Fact]
    public async Task Handle_WithDuplicateSlug_ThrowsConflictException()
    {
        var catId = await SeedCategoryAsync();
        var handler = new CreateShelterModelCommandHandler(_db);
        await handler.Handle(ValidCommand(catId, "abri-double"), CancellationToken.None);

        var act = async () => await handler.Handle(
            ValidCommand(catId, "Abri-Double"), CancellationToken.None);  // même slug normalisé

        await act.Should().ThrowAsync<ConflictException>().WithMessage("*abri-double*");
    }

    [Fact]
    public async Task Handle_WithUnknownCategory_ThrowsNotFoundException()
    {
        var handler = new CreateShelterModelCommandHandler(_db);

        var act = async () => await handler.Handle(
            ValidCommand(Guid.NewGuid()), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    public void Dispose() => _db.Dispose();
}
