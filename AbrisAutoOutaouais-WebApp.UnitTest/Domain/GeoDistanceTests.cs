using AbrisAutoOutaouais_WebApp.Domain.Common;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Domain;

/// <summary>
/// Vérifie l'utilitaire Haversine + la zone de service (D5). Ce socle serveur est le MIROIR exact
/// de <c>service-area.util.ts</c> (front) — base 45.4765/-75.7013, rayon 100 km (L-007/L-004) — et
/// reste INFORMATIF : aucune règle ne rejette une adresse hors zone (cf.
/// <c>PlaceOrderCommandValidatorTests.Validate_DeliveryWithNonQuebecProvince_HasNoValidationErrors</c>).
/// </summary>
public sealed class GeoDistanceTests
{
    [Fact]
    public void HaversineKm_SamePoint_IsZero()
    {
        var d = GeoDistance.HaversineKm(
            GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng,
            GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng);

        d.Should().BeApproximately(0, 1e-6);
    }

    [Fact]
    public void HaversineKm_BaseToMontreal_IsAround160Km()
    {
        // Montréal ≈ 45.5019, -73.5674.
        var d = GeoDistance.HaversineKm(
            GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng, 45.5019, -73.5674);

        d.Should().BeInRange(150, 180);
    }

    [Fact]
    public void HaversineKm_IsSymmetric()
    {
        var ab = GeoDistance.HaversineKm(
            GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng, 43.6532, -79.3832);
        var ba = GeoDistance.HaversineKm(
            43.6532, -79.3832, GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng);

        ab.Should().BeApproximately(ba, 1e-6);
    }

    [Fact]
    public void IsWithinServiceArea_Base_IsTrue()
    {
        GeoDistance.IsWithinServiceArea(GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng)
            .Should().BeTrue();
    }

    [Theory]
    [InlineData(45.5019, -73.5674)] // Montréal (~160 km) — hors zone
    [InlineData(43.6532, -79.3832)] // Toronto (~450 km) — hors zone
    public void IsWithinServiceArea_FarPoints_IsFalse(double lat, double lng)
    {
        GeoDistance.IsWithinServiceArea(lat, lng).Should().BeFalse();
    }

    [Fact]
    public void IsWithinServiceArea_BordersTheRadiusThreshold()
    {
        // 1° de longitude à la latitude de base ≈ 78 km → on calibre deux points plein est.
        var kmPerDegLng = GeoDistance.HaversineKm(
            GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng,
            GeoDistance.ServiceBaseLat, GeoDistance.ServiceBaseLng + 1);

        var justInside = GeoDistance.ServiceBaseLng + 99 / kmPerDegLng;
        var justOutside = GeoDistance.ServiceBaseLng + 101 / kmPerDegLng;

        GeoDistance.IsWithinServiceArea(GeoDistance.ServiceBaseLat, justInside).Should().BeTrue();
        GeoDistance.IsWithinServiceArea(GeoDistance.ServiceBaseLat, justOutside).Should().BeFalse();
    }

    [Fact]
    public void ServiceConstants_MirrorTheClientUtil()
    {
        // Verrou anti-dérive (L-007/L-004) : ces valeurs DOIVENT rester identiques à
        // `service-area.util.ts` (SERVICE_BASE / SERVICE_RADIUS_KM).
        GeoDistance.ServiceBaseLat.Should().Be(45.4765);
        GeoDistance.ServiceBaseLng.Should().Be(-75.7013);
        GeoDistance.ServiceRadiusKm.Should().Be(100);
    }
}
