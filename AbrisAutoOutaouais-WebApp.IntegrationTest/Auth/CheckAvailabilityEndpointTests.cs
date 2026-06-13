using AbrisAutoOutaouais_WebApp.Application.Auth.CheckAvailability;
using System;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Auth;

/// <summary>
/// Endpoint d'aide à l'inscription (H5) : GET /auth/availability répond 200 et
/// indique, pour chaque identifiant FOURNI, s'il est libre ou déjà pris. Aide
/// UX assumée — pas d'anti-énumération ici (contrairement à forgot-password).
/// </summary>
[Collection("Integration")]
public sealed class CheckAvailabilityEndpointTests(WebAppFactory factory)
    : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client = factory.Client;

    private async Task<AvailabilityDto> GetAvailabilityAsync(string query)
    {
        var response = await _client.GetAsync($"/api/v1/auth/availability?{query}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<AvailabilityDto>())!;
    }

    [Fact]
    public async Task Availability_WithFreeUsernameAndEmail_ReportsBothAvailable()
    {
        var unique = Guid.NewGuid().ToString("N")[..8];
        var dto = await GetAvailabilityAsync(
            $"username=libre-{unique}&email=libre-{unique}@test.com");

        dto.UsernameAvailable.Should().BeTrue();
        dto.EmailAvailable.Should().BeTrue();
    }

    [Fact]
    public async Task Availability_WithTakenEmail_ReportsEmailUnavailable()
    {
        // Le compte admin est créé par l'IdentitySeeder au démarrage.
        var dto = await GetAvailabilityAsync("email=admin@abrisauto.com");

        dto.EmailAvailable.Should().BeFalse();
        dto.UsernameAvailable.Should().BeNull();
    }

    [Fact]
    public async Task Availability_AfterRegistration_ReportsUsernameTaken()
    {
        var unique = Guid.NewGuid().ToString("N")[..8];
        var username = $"dispo-{unique}";

        var register = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email = $"dispo-{unique}@test.com",
            username,
            firstName = "Disponible",
            lastName = "Test",
            password = "Test@123!",
            confirmPassword = "Test@123!",
        });
        register.EnsureSuccessStatusCode();

        var dto = await GetAvailabilityAsync($"username={username}");
        dto.UsernameAvailable.Should().BeFalse();
    }

    [Fact]
    public async Task Availability_WithNoParam_Returns200AndBothNull()
    {
        var dto = await GetAvailabilityAsync(string.Empty);

        dto.UsernameAvailable.Should().BeNull();
        dto.EmailAvailable.Should().BeNull();
    }
}
