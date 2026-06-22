using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Payroll;

/// <summary>
/// Endpoints de paie INFORMATIVE (EPIC 8, US-8.1) — vraie pile HTTP + JWT réel. Tout est
/// <c>AdminOnly</c> :
///  • GET /api/v1/payroll/summary : 401 anonyme, 403 Staff, 200 Admin ;
///  • PUT /api/v1/payroll/employees/{id}/rate : 403 Staff, 204 Admin ;
///  • PUT /api/v1/payroll/mark-paid : transitionne le statut, le récap le reflète, et calcule le montant.
/// [Collection("Integration")] obligatoire — host/DB partagés (L-010).
/// </summary>
[Collection("Integration")]
public sealed class PayrollEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public PayrollEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    private static string Today => DateTime.UtcNow.ToString("yyyy-MM-dd");

    private async Task<(Guid UserId, string Token)> RegisterAndLoginAsync(string? role = null)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"pay-{suffix}@test.com";
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

    // ── Autorisation : GET /payroll/summary ───────────────────────────────────────

    [Fact]
    public async Task GetSummary_Anonymous_Returns401()
    {
        var response = await _client.GetAsync($"/api/v1/payroll/summary?from={Today}&to={Today}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetSummary_AsStaff_Returns403()
    {
        var (_, token) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(token);

        var response = await _client.GetAsync($"/api/v1/payroll/summary?from={Today}&to={Today}");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetSummary_AsAdmin_Returns200()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.GetAsync($"/api/v1/payroll/summary?from={Today}&to={Today}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetSummary_FromAfterTo_Returns422()
    {
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        var response = await _client.GetAsync(
            $"/api/v1/payroll/summary?from=2026-08-01&to=2026-07-01");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Autorisation : PUT /payroll/employees/{id}/rate ───────────────────────────

    [Fact]
    public async Task SetRate_AsStaff_Returns403()
    {
        var (staffId, token) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(token);

        var response = await _client.PutAsJsonAsync(
            $"/api/v1/payroll/employees/{staffId}/rate", new { hourlyRate = 25m });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Bout en bout : taux + heures + marquage → montant et statut dans le récap ─

    [Fact]
    public async Task EndToEnd_RateThenHoursThenMarkPaid_SummaryReflectsAmountAndStatus()
    {
        var (staffId, _) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        // 1) Définir le taux à 20 $/h (204).
        var setRate = await _client.PutAsJsonAsync(
            $"/api/v1/payroll/employees/{staffId}/rate", new { hourlyRate = 20m });
        setRate.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // 2) Saisir 8h00 → 17h00 = 540 min via l'endpoint planning (Admin).
        var hours = await _client.PutAsJsonAsync("/api/v1/planning/work-hours", new
        {
            employeeId = staffId,
            date = Today,
            startMinutes = 480,
            endMinutes = 1020,
            note = (string?)null,
        });
        hours.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3) Récap : 540 min, montant = 9 h × 20 $ = 180 $, statut À payer.
        var summary = await _client.GetAsync($"/api/v1/payroll/summary?from={Today}&to={Today}");
        summary.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await summary.Content.ReadFromJsonAsync<JsonElement>();
        var emp = FindEmployee(json, staffId);
        emp.GetProperty("totalMinutes").GetInt32().Should().Be(540);
        emp.GetProperty("amount").GetDecimal().Should().Be(180m);
        emp.GetProperty("payStatus").GetString().Should().Be("AnsPayer");

        // 4) Marquer la période payée → { updated: 1 }.
        var markPaid = await _client.PutAsJsonAsync("/api/v1/payroll/mark-paid", new
        {
            employeeId = staffId,
            from = Today,
            to = Today,
            status = "Payee",
        });
        markPaid.StatusCode.Should().Be(HttpStatusCode.OK);
        var markJson = await markPaid.Content.ReadFromJsonAsync<JsonElement>();
        markJson.GetProperty("updated").GetInt32().Should().Be(1);

        // 5) Récap de nouveau : le statut est maintenant Payée.
        var summary2 = await _client.GetAsync($"/api/v1/payroll/summary?from={Today}&to={Today}");
        var json2 = await summary2.Content.ReadFromJsonAsync<JsonElement>();
        FindEmployee(json2, staffId).GetProperty("payStatus").GetString().Should().Be("Payee");

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task SetRate_Null_ClearsRate_SummaryAmountNull()
    {
        var (staffId, _) = await RegisterAndLoginAsync(Roles.Staff);
        _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

        await _client.PutAsJsonAsync(
            $"/api/v1/payroll/employees/{staffId}/rate", new { hourlyRate = 20m });
        // Retirer le taux.
        var clear = await _client.PutAsJsonAsync(
            $"/api/v1/payroll/employees/{staffId}/rate", new { hourlyRate = (decimal?)null });
        clear.StatusCode.Should().Be(HttpStatusCode.NoContent);

        await _client.PutAsJsonAsync("/api/v1/planning/work-hours", new
        {
            employeeId = staffId,
            date = Today,
            startMinutes = 480,
            endMinutes = 1020,
            note = (string?)null,
        });

        var summary = await _client.GetAsync($"/api/v1/payroll/summary?from={Today}&to={Today}");
        var json = await summary.Content.ReadFromJsonAsync<JsonElement>();
        var emp = FindEmployee(json, staffId);
        // Taux retiré → montant null (jamais 0), mais les minutes restent comptées.
        emp.GetProperty("totalMinutes").GetInt32().Should().Be(540);
        emp.GetProperty("amount").ValueKind.Should().Be(JsonValueKind.Null);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    private static JsonElement FindEmployee(JsonElement summary, Guid staffId)
    {
        foreach (var emp in summary.GetProperty("employees").EnumerateArray())
        {
            if (emp.GetProperty("employeeId").GetGuid() == staffId)
                return emp;
        }

        throw new Xunit.Sdk.XunitException($"Employé {staffId} absent du récap.");
    }
}
