using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Products;

/// <summary>
/// Tests de bout en bout pour les endpoints /api/v1/products.
/// Utilise une vraie HTTP stack, DB InMemory, JWT réel.
/// </summary>
[Collection("Integration")]  // Partage WebAppFactory — pas de parallélisme
public sealed class ProductsEndpointTests(WebAppFactory factory)
    : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client = factory.Client;

    // ── GET /api/v1/products ─────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_Anonymous_Returns200WithEmptyList()
    {
        var response = await _client.GetAsync("/api/v1/products");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PaginatedList<ProductDto>>();
        body.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAll_WithSeededProducts_ReturnsPaginatedList()
    {
        await DbHelper.SeedProductAsync(factory.Services, slug: "test-pagination");

        var response = await _client.GetAsync("/api/v1/products?page=1&pageSize=12");
        var body = await response.Content.ReadFromJsonAsync<PaginatedList<ProductDto>>();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body!.Items.Should().NotBeEmpty();
    }

    // ── GET /api/v1/products/{slug} ─────────────────────────────────────────

    [Fact]
    public async Task GetBySlug_ExistingProduct_Returns200()
    {
        await DbHelper.SeedProductAsync(factory.Services, slug: "abri-unique-slug");

        var response = await _client.GetAsync("/api/v1/products/abri-unique-slug");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ProductDto>();
        dto!.Slug.Should().Be("abri-unique-slug");
    }

    [Fact]
    public async Task GetBySlug_UnknownSlug_Returns404WithProblemDetails()
    {
        var response = await _client.GetAsync("/api/v1/products/inexistant-xyz");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Vérifie que la réponse est bien un ProblemDetails RFC 9457
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(404);
        problem.Title.Should().Be("Ressource introuvable");
    }

    // ── POST /api/v1/products ────────────────────────────────────────────────

    [Fact]
    public async Task Create_AsAnonymous_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/products",
            new { name = "Test", slug = "test", price = 100, stock = 5, categoryId = Guid.NewGuid() });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_AsAdmin_Returns201WithId()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        // Seeder une catégorie d'abord
        await DbHelper.SeedProductAsync(factory.Services, slug: "categorie-seed");
        var db = factory.Services.CreateScope().ServiceProvider
            .GetRequiredService<ApplicationDbContext>();
        var catId = await db.ProductCategories.Select(c => c.Id).FirstAsync();

        var response = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "Abri Double Nouveau",
            slug = "abri-double-nouveau",
            price = 499.99,
            stock = 3,
            categoryId = catId,
            description = "Abri pour deux voitures",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = await response.Content.ReadFromJsonAsync<Guid>();
        id.Should().NotBeEmpty();

        // Nettoyage : reset le header
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task Create_AsAdmin_WithInvalidData_Returns422()
    {
        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);

        var response = await _client.PostAsJsonAsync("/api/v1/products", new
        {
            name = "",      // Invalide
            slug = "SLUG INVALIDE!",  // Invalide
            price = -10,     // Invalide
            stock = -5,      // Invalide
            categoryId = Guid.Empty,  // Invalide
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);

        _client.DefaultRequestHeaders.Authorization = null;
    }
}
