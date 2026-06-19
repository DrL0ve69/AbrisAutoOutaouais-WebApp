using AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.DeleteShelterModel;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Shelters;

public sealed class DeleteShelterModelCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();

    private async Task<ShelterModel> SeedAsync()
    {
        var cat = ProductCategory.Create("Abris autos", "abris-autos");
        var model = ShelterModel.Create(
            "abri-supp", "Abri à supprimer", cat.Id,
            122, 122, 1830, 349m, 15000, [244], [198]);
        _db.ProductCategories.Add(cat);
        _db.ShelterModels.Add(model);
        await _db.SaveChangesAsync();
        return model;
    }

    [Fact]
    public async Task Handle_WithUnknownId_ThrowsNotFoundException()
    {
        var handler = new DeleteShelterModelCommandHandler(_db);

        var act = async () => await handler.Handle(
            new DeleteShelterModelCommand(Guid.NewGuid()), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WithExistingId_SoftDeletesModel()
    {
        var model = await SeedAsync();
        var handler = new DeleteShelterModelCommandHandler(_db);

        var result = await handler.Handle(
            new DeleteShelterModelCommand(model.Id), CancellationToken.None);

        result.Should().BeTrue();
        // Soft-delete : exclu du filtre global (requête normale), mais présent en ignorant les
        // filtres avec IsDeleted=true. (FindAsync contourne les query filters — on requête donc
        // explicitement pour vérifier l'exclusion.)
        var visible = await _db.ShelterModels.FirstOrDefaultAsync(m => m.Id == model.Id);
        visible.Should().BeNull();
        var raw = await _db.ShelterModels.IgnoreQueryFilters()
            .FirstAsync(m => m.Id == model.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    public void Dispose() => _db.Dispose();
}
