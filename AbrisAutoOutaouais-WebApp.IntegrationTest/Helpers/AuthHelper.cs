using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.helpers;

/// <summary>Génère des tokens JWT pour les tests d'intégration authentifiés.</summary>
public static class AuthHelper
{
    // Identifiants du compte admin créé par IdentitySeeder (source de vérité).
    public static async Task<string> LoginAsAdminAsync(HttpClient client)
        => await LoginAsync(client, "admin@abrisauto.com", "Admin123!");

    public static async Task<string> LoginAsync(
        HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email, password });

        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        return auth!.Token;
    }

    /// <summary>Configure le client avec le header Authorization.</summary>
    public static void SetBearerToken(this HttpClient client, string token)
        => client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
}
