using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.helpers;

/// <summary>
/// Fabrique de données de test pour les LOCATIONS (rework « location sur modèle paramétrique »).
/// Construit un <see cref="ShelterModel"/> LOUABLE (tarif mensuel non nul) avec une grille DENSE
/// sur [122, 366] par pas de 122, hauteurs {198}, et une catégorie associée — slug et catégorie
/// uniques par appel pour isoler les tests dans la base InMemory partagée (L-010). Une taille valide
/// pour ce modèle est (122, 198), (244, 198) ou (366, 198).
/// </summary>
public static class RentalTestData
{
    /// <summary>
    /// Persiste une catégorie + un modèle LOUABLE dans <paramref name="db"/> (FK catégorie valide) et
    /// retourne le modèle. N'appelle PAS <c>SaveChanges</c> (l'appelant le fait, souvent avec d'autres
    /// entités dans la même transaction). Slug/catégorie uniques par appel.
    /// </summary>
    public static ShelterModel AddRentableModel(ApplicationDbContext db, int monthlyRentalCents = 4900)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var category = ProductCategory.Create($"Abris {suffix}", $"abris-{suffix}");

        const int min = 122, max = 366, step = 122;
        var heights = new[] { 198 };
        var grid = new List<ShelterModel.PriceEntryInput>();
        for (var length = min; length <= max; length += step)
            foreach (var h in heights)
                grid.Add(new ShelterModel.PriceEntryInput(length, h, 34900 + (length - min) / step * 5000));

        var model = ShelterModel.Create(
            $"abri-loc-{suffix}", $"Abri location {suffix}", category.Id,
            step, min, max,
            widthsCm: [335], clearHeightsCm: heights,
            priceEntries: grid,
            monthlyRentalCents: monthlyRentalCents);

        db.ProductCategories.Add(category);
        db.ShelterModels.Add(model);
        return model;
    }
}
