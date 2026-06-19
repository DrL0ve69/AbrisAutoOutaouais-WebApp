using AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.UpdateShelterModel;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Shelters;

public sealed class UpdateShelterModelCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    private async Task<(Guid CategoryId, ShelterModel Model)> SeedAsync()
    {
        var cat = ProductCategory.Create("Abris autos", "abris-autos");
        var model = ShelterModel.Create(
            "abri-edit", "Abri à éditer", cat.Id,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            basePrice: 349m, pricePerArchCents: 15000,
            widthsCm: [244], clearHeightsCm: [198]);
        _db.ProductCategories.Add(cat);
        _db.ShelterModels.Add(model);
        await _db.SaveChangesAsync();
        return (cat.Id, model);
    }

    [Fact]
    public async Task Handle_WithUnknownId_ThrowsNotFoundException()
    {
        var (catId, _) = await SeedAsync();
        var handler = new UpdateShelterModelCommandHandler(_db);

        var cmd = new UpdateShelterModelCommand(
            Guid.NewGuid(), "X", catId, 122, 122, 1830, 349m, 15000, [244], [198]);

        var act = async () => await handler.Handle(cmd, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WithUnknownCategory_ThrowsNotFoundException()
    {
        var (_, model) = await SeedAsync();
        var handler = new UpdateShelterModelCommandHandler(_db);

        var cmd = new UpdateShelterModelCommand(
            model.Id, "X", Guid.NewGuid(), 122, 122, 1830, 349m, 15000, [244], [198]);

        var act = async () => await handler.Handle(cmd, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WithValidCommand_AppliesReconfigureAndKeepsSlug()
    {
        var (catId, model) = await SeedAsync();
        var handler = new UpdateShelterModelCommandHandler(_db);

        var cmd = new UpdateShelterModelCommand(
            model.Id, "Abri renommé", catId,
            LengthStepCm: 122, MinLengthCm: 122, MaxLengthCm: 1830,
            BasePrice: 599m, PricePerArchCents: 22000,
            WidthsCm: [305, 366], ClearHeightsCm: [213]);

        var result = await handler.Handle(cmd, CancellationToken.None);

        result.Should().BeTrue();
        var saved = await _db.ShelterModels.FindAsync(model.Id);
        saved!.Slug.Should().Be("abri-edit");          // immuable
        saved.Name.Should().Be("Abri renommé");
        saved.BasePrice.Should().Be(599m);
        saved.WidthOptionsCm.Should().Equal(305, 366);
        saved.ClearHeightOptionsCm.Should().Equal(213);
    }

    public void Dispose() => _db.Dispose();
}
