using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Bookings;

/// <summary>
/// Ajout d'un RDV depuis le calendrier admin (US-11.2 p2) — vraie pile HTTP + JWT réel + DB InMemory.
/// Couvre la résolution sécurisée de <c>CustomerId</c> (repli silencieux pour un appelant non staff,
/// L-028), le rattachement à un client existant ou à un compte express (Admin), et la recherche de
/// clients (<c>GET /planning/customers</c> : 403 non-admin, filtre Customer + exclusion des express
/// anonymes). Collection « Integration » partagée → un seul host/seeder (L-010).
/// </summary>
[Collection("Integration")]
public sealed class AdminCreateBookingEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public AdminCreateBookingEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    private static DateTime Slot(int addDays, int hourUtc)
    {
        var day = DateTime.UtcNow.Date.AddDays(addDays);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return new DateTime(day.Year, day.Month, day.Day, hourUtc, 0, 0, DateTimeKind.Utc);
    }

    /// <summary>Inscrit un client (rôle Customer) et renvoie (Id, token, courriel, nom complet).</summary>
    private async Task<(Guid UserId, string Token, string Email, string FullName)> RegisterCustomerAsync(
        string firstName = "Test", string lastName = "Client")
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = $"acb-{suffix}@test.com";
        const string password = "Test1234!";

        var register = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username = $"u{suffix}"[..16],
            password,
            confirmPassword = password,
            firstName,
            lastName,
        });
        register.EnsureSuccessStatusCode();

        var login = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<JsonElement>();
        return (
            body.GetProperty("userId").GetGuid(),
            body.GetProperty("token").GetString()!,
            email,
            $"{firstName} {lastName}".Trim());
    }

    private async Task LoginAsAdminAsync()
        => _client.SetBearerToken(await AuthHelper.LoginAsAdminAsync(_client));

    private static object Payload(
        DateTime slot, Guid? targetCustomerId = null, object? guestContact = null) => new
    {
        slotStart = slot,
        type = "Installation",
        address = new
        {
            civicNumber = "123",
            street = "rue des Érables",
            apartment = (string?)null,
            city = "Gatineau",
            province = "QC",
            postalCode = "J8X 1A1",
            country = "Canada",
        },
        notes = (string?)null,
        brand = (string?)null,
        model = (string?)null,
        guestContact,
        targetCustomerId,
    };

    private async Task<Guid> ReadCustomerIdAsync(Guid bookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = await db.BookingSlots.AsNoTracking().FirstAsync(b => b.Id == bookingId);
        return booking.CustomerId;
    }

    private async Task<Guid?> FindUserIdByEmailAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var user = await userManager.FindByEmailAsync(email);
        return user?.Id;
    }

    /// <summary>Crée un compte express ANONYME (IsExpress, sans nom) pour vérifier qu'il est exclu.</summary>
    private async Task<string> SeedAnonymousExpressAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var email = $"express-{Guid.NewGuid():N}@test.com";
        var user = new AppUser
        {
            UserName = email,
            Email = email,
            FirstName = "",
            LastName = "",
            IsExpress = true,
            EmailConfirmed = false,
            CreatedAt = DateTime.UtcNow,
        };
        (await userManager.CreateAsync(user)).Succeeded.Should().BeTrue();
        await userManager.AddToRoleAsync(user, Roles.Customer);
        return email;
    }

    // ── (a) Repli silencieux : Customer ciblant un autre client → SON propre id (L-028) ──────────

    [Fact]
    public async Task Create_AsCustomer_WithTargetCustomerId_IgnoredAndUsesOwnId()
    {
        var (ownId, token, _, _) = await RegisterCustomerAsync();
        var (otherId, _, _, _) = await RegisterCustomerAsync();
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync(
            "/api/v1/bookings", Payload(Slot(50, 10), targetCustomerId: otherId));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        // Repli prouvé : le RDV est rattaché au demandeur, PAS au client ciblé.
        var customerId = await ReadCustomerIdAsync(id);
        customerId.Should().Be(ownId);
        customerId.Should().NotBe(otherId);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── (b) Admin ciblant un client existant → ce client ────────────────────────────────────────

    [Fact]
    public async Task Create_AsAdmin_WithTargetCustomerId_AttachesToThatCustomer()
    {
        var (clientId, _, _, _) = await RegisterCustomerAsync();
        await LoginAsAdminAsync();

        var response = await _client.PostAsJsonAsync(
            "/api/v1/bookings", Payload(Slot(51, 10), targetCustomerId: clientId));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        (await ReadCustomerIdAsync(id)).Should().Be(clientId);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── (c) Admin avec GuestContact → compte express créé/réutilisé ──────────────────────────────

    [Fact]
    public async Task Create_AsAdmin_WithGuestContact_CreatesExpressAccount()
    {
        var guestEmail = $"newguest-{Guid.NewGuid():N}@test.com";
        await LoginAsAdminAsync();

        var response = await _client.PostAsJsonAsync(
            "/api/v1/bookings",
            Payload(Slot(52, 10), guestContact: new
            {
                firstName = "Nouveau",
                lastName = "Contact",
                email = guestEmail,
                phone = (string?)null,
            }));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var expressId = await FindUserIdByEmailAsync(guestEmail);
        expressId.Should().NotBeNull();
        (await ReadCustomerIdAsync(id)).Should().Be(expressId!.Value);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── (d) GET /planning/customers : 403 non-admin, filtre Customer sans express anonyme ────────

    [Fact]
    public async Task SearchCustomers_AsCustomer_Returns403()
    {
        var (_, token, _, _) = await RegisterCustomerAsync();
        _client.SetBearerToken(token);

        var response = await _client.GetAsync("/api/v1/planning/customers?term=test");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task SearchCustomers_AsAdmin_FiltersCustomersAndExcludesAnonymousExpress()
    {
        // Un client réel au nom unique + un compte express anonyme (sans nom) partageant le terme.
        var token = $"Zorglub{Guid.NewGuid():N}"[..14];
        var (realId, _, realEmail, _) = await RegisterCustomerAsync(firstName: token, lastName: "Réel");
        var expressEmail = await SeedAnonymousExpressAsync();
        await LoginAsAdminAsync();

        var response = await _client.GetAsync($"/api/v1/planning/customers?term={token}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var results = await response.Content.ReadFromJsonAsync<List<CustomerSearchResultDto>>();
        results.Should().NotBeNull();

        // Le client réel correspondant au terme est présent…
        results!.Should().Contain(r => r.Id == realId);
        // …et aucun compte express anonyme (sans nom) ne pollue la liste.
        results!.Should().NotContain(r => r.Email == expressEmail);
        // Bornage à 10 résultats max.
        results!.Count.Should().BeLessThanOrEqualTo(10);

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task SearchCustomers_AsAdmin_ByEmail_FindsCustomer()
    {
        var (realId, _, realEmail, _) = await RegisterCustomerAsync();
        await LoginAsAdminAsync();

        // Recherche par fragment de courriel (les courriels sont préfixés « acb- »).
        var fragment = realEmail.Split('@')[0];
        var response = await _client.GetAsync($"/api/v1/planning/customers?term={fragment}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var results = await response.Content.ReadFromJsonAsync<List<CustomerSearchResultDto>>();
        results!.Should().Contain(r => r.Id == realId);

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
