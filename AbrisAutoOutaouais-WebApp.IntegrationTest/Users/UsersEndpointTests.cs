using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Users;

/// <summary>
/// Endpoint d'administration des utilisateurs : GET /api/v1/users.
/// Vraie pile HTTP + JWT réel + DB InMemory. 401 anonyme, 403 Customer,
/// 200 Admin avec le compte admin semé par IdentitySeeder dans la liste.
/// </summary>
[Collection("Integration")]
public sealed class UsersEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;

    public UsersEndpointTests(WebAppFactory factory)
    {
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<string> RegisterAndLoginAsCustomerAsync()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"adminu-{suffix}@test.com";
        const string password = "Test1234!";

        var register = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username = $"u{suffix}"[..16],
            password,
            confirmPassword = password,
            firstName = "Test",
            lastName = "Client",
        });
        register.EnsureSuccessStatusCode();

        return await AuthHelper.LoginAsync(_client, email, password);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_Anonymous_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/users");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAll_AsCustomer_Returns403()
    {
        _client.SetBearerToken(await RegisterAndLoginAsCustomerAsync());

        var response = await _client.GetAsync("/api/v1/users");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetAll_AsAdmin_Returns200WithSeededAdmin()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.GetAsync("/api/v1/users");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var users = await response.Content.ReadFromJsonAsync<JsonElement>();
        users.ValueKind.Should().Be(JsonValueKind.Array);

        var admin = users.EnumerateArray()
            .FirstOrDefault(u => u.GetProperty("email").GetString() == "admin@abrisauto.com");
        admin.ValueKind.Should().Be(JsonValueKind.Object, "le compte admin semé doit figurer dans la liste");
        admin.GetProperty("roles").EnumerateArray()
            .Select(r => r.GetString())
            .Should().Contain("Admin");
        admin.GetProperty("isLockedOut").GetBoolean().Should().BeFalse();

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
