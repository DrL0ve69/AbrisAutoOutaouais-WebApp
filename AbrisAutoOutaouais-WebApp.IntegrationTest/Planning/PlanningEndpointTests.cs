using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Planning;

/// <summary>
/// Endpoints planning (US-11.2). Vraie pile HTTP + JWT réel.
///  • GET /api/v1/planning/day : lecture <c>StaffOrAbove</c> (401 anonyme, 403 Customer, 200 Staff/Admin) ;
///  • PUT /api/v1/planning/work-hours : écriture <c>AdminOnly</c> (403 Staff, 200 Admin, 422 fin ≤ début).
/// [Collection("Integration")] obligatoire — host/DB partagés (L-010).
/// </summary>
[Collection("Integration")]
public sealed class PlanningEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public PlanningEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    private static string Today => DateTime.UtcNow.ToString("yyyy-MM-dd");

    private async Task<(Guid UserId, string Token)> RegisterAndLoginAsync(string? role = null)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"plan-{suffix}@test.com";
        const string password = "Test1234!";

        var register = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username = $"u{suffix}"[..16],
            password,
            confirmPassword = password,
            firstName = "Test",
            lastName = "Employé",
        });
        register.EnsureSuccessStatusCode();
        var registered = await register.Content.ReadFromJsonAsync<JsonElement>();
        var userId = registered.GetProperty("userId").GetGuid();

        if (role is not null)
        {
            using var scope = _factory.Services.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var user = await userManager.FindByIdAsync(userId.ToString());
            await userManager.AddToRoleAsync(user!, role);
        }

        var login = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        return (userId, body.GetProperty("token").GetString()!);
    }

    // ── Lecture : GET /planning/day ───────────────────────────────────────────────

    [Fact]
    public async Task GetDay_Anonymous_Returns401()
    {
        var response = await _client.GetAsync($"/api/v1/planning/day?date={Today}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetDay_AsCustomer_Returns403()
    {
        var (_, token) = await RegisterAndLoginAsync();
        _client.SetBearerToken(token);

        var response = await _client.GetAsync($"/api/v1/planning/day?date={Today}");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetDay_AsStaff_Returns200_WithStaffList()
    {
        var (staffId, staffToken) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(staffToken);

        var response = await _client.GetAsync($"/api/v1/planning/day?date={Today}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        // L'employé Staff lui-même figure dans la liste des employés.
        json.Should().Contain(staffId.ToString());
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetDay_AsAdmin_Returns200()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.GetAsync($"/api/v1/planning/day?date={Today}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Écriture : PUT /planning/work-hours ───────────────────────────────────────

    [Fact]
    public async Task UpsertWorkHours_AsStaff_Returns403()
    {
        var (staffId, staffToken) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(staffToken);

        var response = await _client.PutAsJsonAsync("/api/v1/planning/work-hours", new
        {
            employeeId = staffId,
            date = Today,
            startMinutes = 480,
            endMinutes = 1020,
            note = (string?)null,
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task UpsertWorkHours_AsAdmin_Returns200_AndPersists()
    {
        // Un employé Staff à qui attribuer des heures.
        var (staffId, _) = await RegisterAndLoginAsync(Roles.Staff);

        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var put = await _client.PutAsJsonAsync("/api/v1/planning/work-hours", new
        {
            employeeId = staffId,
            date = Today,
            startMinutes = 480,
            endMinutes = 1020,
            note = "Quart du matin",
        });

        put.StatusCode.Should().Be(HttpStatusCode.OK);

        // Re-lecture du jour : l'employé porte désormais ses heures.
        var day = await _client.GetAsync($"/api/v1/planning/day?date={Today}");
        var json = await day.Content.ReadAsStringAsync();
        json.Should().Contain("480").And.Contain("1020").And.Contain("Quart du matin");
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task UpsertWorkHours_EndBeforeStart_Returns422()
    {
        var (staffId, _) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.PutAsJsonAsync("/api/v1/planning/work-hours", new
        {
            employeeId = staffId,
            date = Today,
            startMinutes = 1020,
            endMinutes = 480, // fin avant début → 422
            note = (string?)null,
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        _client.DefaultRequestHeaders.Authorization = null;
    }
}
