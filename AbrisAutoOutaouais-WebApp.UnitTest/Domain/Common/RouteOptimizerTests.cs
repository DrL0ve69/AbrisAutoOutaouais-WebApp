using AbrisAutoOutaouais_WebApp.Domain.Common;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain.Common;

/// <summary>
/// Vérifie l'heuristique « plus proche voisin » de <see cref="RouteOptimizer"/> (US-11.3) :
/// ordre correct sur des points connus, distance totale cohérente, et cas dégénérés (0 / 1 arrêt).
/// Fonction pure — aucune dépendance, aucun appel réseau (routage maison, budget « zéro frais »).
/// </summary>
public sealed class RouteOptimizerTests
{
    // Base de service (Gatineau) — point de départ de la tournée.
    private const double BaseLat = GeoDistance.ServiceBaseLat;
    private const double BaseLng = GeoDistance.ServiceBaseLng;

    [Fact]
    public void Optimize_EmptyList_ReturnsEmptyResult()
    {
        var result = RouteOptimizer.Optimize([], BaseLat, BaseLng);

        result.Stops.Should().BeEmpty();
        result.TotalKm.Should().Be(0);
    }

    [Fact]
    public void Optimize_SingleStop_ReturnsItWithLegFromBase()
    {
        var stop = new RouteStop(Guid.NewGuid(), 45.5, -75.6);

        var result = RouteOptimizer.Optimize([stop], BaseLat, BaseLng);

        result.Stops.Should().ContainSingle();
        result.Stops[0].Order.Should().Be(0);
        result.Stops[0].Stop.Should().Be(stop);
        // Le seul segment = base → arrêt ; total == ce segment.
        var expected = GeoDistance.HaversineKm(BaseLat, BaseLng, 45.5, -75.6);
        result.Stops[0].LegKm.Should().BeApproximately(expected, 1e-9);
        result.TotalKm.Should().BeApproximately(expected, 1e-9);
    }

    [Fact]
    public void Optimize_OrdersByNearestNeighbourFromBase()
    {
        // Trois arrêts à distance CROISSANTE de la base, fournis dans le DÉSORDRE. L'heuristique
        // doit les ressortir du plus proche au plus lointain : proche → moyen → loin.
        var near = new RouteStop(Guid.NewGuid(), 45.49, -75.71); // tout près de la base
        var mid = new RouteStop(Guid.NewGuid(), 45.6, -75.5); // plus loin
        var far = new RouteStop(Guid.NewGuid(), 46.0, -74.5); // le plus loin

        var result = RouteOptimizer.Optimize([far, near, mid], BaseLat, BaseLng);

        result.Stops.Select(s => s.Stop.Id)
            .Should().ContainInOrder(near.Id, mid.Id, far.Id);
        result.Stops.Select(s => s.Order).Should().ContainInOrder(0, 1, 2);
    }

    [Fact]
    public void Optimize_TotalKm_EqualsSumOfLegs()
    {
        var a = new RouteStop(Guid.NewGuid(), 45.49, -75.71);
        var b = new RouteStop(Guid.NewGuid(), 45.6, -75.5);
        var c = new RouteStop(Guid.NewGuid(), 46.0, -74.5);

        var result = RouteOptimizer.Optimize([a, b, c], BaseLat, BaseLng);

        var sumOfLegs = result.Stops.Sum(s => s.LegKm);
        result.TotalKm.Should().BeApproximately(sumOfLegs, 1e-9);
    }

    [Fact]
    public void Optimize_FirstLeg_IsMeasuredFromBase()
    {
        var a = new RouteStop(Guid.NewGuid(), 45.49, -75.71);
        var b = new RouteStop(Guid.NewGuid(), 45.6, -75.5);

        var result = RouteOptimizer.Optimize([a, b], BaseLat, BaseLng);

        // Le premier segment part de la base vers l'arrêt le plus proche (a).
        var expectedFirst = GeoDistance.HaversineKm(BaseLat, BaseLng, a.Lat, a.Lng);
        result.Stops[0].Stop.Id.Should().Be(a.Id);
        result.Stops[0].LegKm.Should().BeApproximately(expectedFirst, 1e-9);
    }
}
