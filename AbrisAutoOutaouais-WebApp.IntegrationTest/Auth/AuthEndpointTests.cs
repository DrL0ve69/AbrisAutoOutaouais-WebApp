using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Auth;

[Collection("Integration")]
public sealed class AuthEndpointTests(WebAppFactory factory)
    : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client = factory.Client;

    [Fact]
    public async Task Login_WithValidCredentials_Returns200WithToken()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email = "admin@abristempo.local",
            password = "Admin@123!",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        auth!.Token.Should().NotBeNullOrEmpty();
        auth.Roles.Should().Contain("Admin");
    }

    [Fact]
    public async Task Login_WithInvalidPassword_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email = "admin@abristempo.local",
            password = "MauvaisMotDePasse",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Register_WithValidData_Returns200WithToken()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email = $"nouveau-{Guid.NewGuid()}@test.com",
            firstName = "Jean",
            lastName = "Tremblay",
            password = "Test@123!",
            confirmPassword = "Test@123!",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        auth!.Token.Should().NotBeNullOrEmpty();
        auth.Roles.Should().Contain("Customer");
    }

    [Fact]
    public async Task Register_WithPasswordMismatch_Returns422()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email = "test@test.com",
            firstName = "Jean",
            lastName = "Tremblay",
            password = "Test@123!",
            confirmPassword = "Différent@456!",  // Ne correspond pas
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetMe_WithValidToken_Returns200WithProfile()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        var response = await _client.GetAsync("/api/v1/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profile = await response.Content.ReadFromJsonAsync<AppUser>();
        profile!.Email.Should().Be("admin@abristempo.local");

        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetMe_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
