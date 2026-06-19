using AbrisAutoOutaouais_WebApp.Domain.Entities;
using AbrisAutoOutaouais_WebApp.Domain.Services;
using AbrisAutoOutaouais_WebApp.IntegrationTest.helpers;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AbrisAutoOutaouais_WebApp.IntegrationTest.Orders;

/// <summary>
/// Tests de bout en bout pour POST /api/v1/orders avec une ligne d'ABRI CONFIGURÉ (EPIC 9.4).
/// Vraie stack HTTP + DB InMemory. Le <c>WebAppFactory</c> ne lance QUE l'IdentitySeeder : on sème
/// donc nos propres modèles d'abri via un scope DI (même patron que <c>SheltersEndpointTests</c>).
///
/// Vérifie surtout que le prix de la ligne persistée est celui RECALCULÉ par le serveur
/// (<c>ShelterPriceCalculator</c>) — le client n'envoie aucun prix. Une longueur hors plage → 422.
/// </summary>
[Collection("Integration")]  // L-010 : partage le WebAppFactory, jamais une collection parallèle.
public sealed class OrdersEndpointTests : IClassFixture<WebAppFactory>
{
    private readonly HttpClient _client;
    private readonly WebAppFactory _factory;

    public OrdersEndpointTests(WebAppFactory factory)
    {
        _factory = factory;
        _client = factory.Client;
        _client.DefaultRequestHeaders.Authorization = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Sème une catégorie + un modèle paramétrique « simple » (pas/min 122 cm, base 349 $,
    /// 150 $/arche) et renvoie le modèle pour calculer le prix attendu via le MÊME calculateur.
    /// Slug/catégorie uniques par appel (base InMemory partagée).
    /// </summary>
    private async Task<ShelterModel> SeedShelterModelAsync(string slug)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var category = ProductCategory.Create($"Cat {slug}", $"cat-{slug}");
        var model = ShelterModel.Create(
            slug, $"Modèle {slug}", category.Id,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
            basePrice: 349.00m, pricePerArchCents: 15000,
            widthsCm: [335, 366], clearHeightsCm: [198]);

        db.ProductCategories.Add(category);
        db.ShelterModels.Add(model);
        await db.SaveChangesAsync();
        return model;
    }

    private async Task<OrderLine> ReadSingleLineAsync(Guid orderId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        // PAS de .Include(Dimensions) — collection owned ; on lit la ligne, pas le modèle.
        return await db.OrderLines.AsNoTracking().SingleAsync(l => l.OrderId == orderId);
    }

    private static object GuestContact(string email) => new
    {
        firstName = "Jean",
        lastName = "Tremblay",
        email,
        phone = "819-555-0199",
    };

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PlaceShelterOrder_Anonymous_Returns201WithServerComputedPrice()
    {
        var model = await SeedShelterModelAsync($"abri-invite-{Guid.NewGuid():N}");
        var email = $"guest-shelter-{Guid.NewGuid():N}@test.com";

        // 488 cm = 122 + 3*122 → 3 arches → 349 + 3*150 = 799 $ (prix calculé côté serveur).
        const int lengthCm = 488;
        var expected = ShelterPriceCalculator.CalculatePrice(model, lengthCm);

        var response = await _client.PostAsJsonAsync("/api/v1/orders", new
        {
            lines = Array.Empty<object>(),
            deliveryType = "Pickup",
            shippingAddress = (object?)null,
            guestContact = GuestContact(email),
            // Le client n'envoie PAS de prix : slug + longueur + quantité seulement.
            shelterLines = new[] { new { slug = model.Slug, lengthCm, quantity = 1 } },
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var orderId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var line = await ReadSingleLineAsync(orderId);
        line.ProductId.Should().BeNull();
        line.ShelterModelSlug.Should().Be(model.Slug);
        line.ConfiguredLengthCm.Should().Be(lengthCm);
        line.UnitPrice.Should().Be(expected);   // prix SERVEUR, pas une valeur client
        line.UnitPrice.Should().Be(799.00m);     // ancrage explicite de la formule
    }

    [Fact]
    public async Task PlaceShelterOrder_OutOfRangeLength_Returns422()
    {
        var model = await SeedShelterModelAsync($"abri-hors-plage-{Guid.NewGuid():N}");
        var email = $"guest-422-{Guid.NewGuid():N}@test.com";

        // 2000 > MaxLengthCm (1830) → 422 (BusinessRuleException), jamais un 500.
        var response = await _client.PostAsJsonAsync("/api/v1/orders", new
        {
            lines = Array.Empty<object>(),
            deliveryType = "Pickup",
            shippingAddress = (object?)null,
            guestContact = GuestContact(email),
            shelterLines = new[] { new { slug = model.Slug, lengthCm = 2000, quantity = 1 } },
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(422);
    }

    [Fact]
    public async Task PlaceShelterOrder_Authenticated_Returns201WithServerComputedPrice()
    {
        var model = await SeedShelterModelAsync($"abri-auth-{Guid.NewGuid():N}");

        var token = await AuthHelper.LoginAsAdminAsync(_client);
        _client.SetBearerToken(token);
        try
        {
            const int lengthCm = 244;   // 122 + 1*122 → 1 arche → 349 + 150 = 499 $.
            var expected = ShelterPriceCalculator.CalculatePrice(model, lengthCm);

            var response = await _client.PostAsJsonAsync("/api/v1/orders", new
            {
                lines = Array.Empty<object>(),
                deliveryType = "Pickup",
                shippingAddress = (object?)null,
                // Connecté : pas de guestContact.
                shelterLines = new[] { new { slug = model.Slug, lengthCm, quantity = 1 } },
            });

            response.StatusCode.Should().Be(HttpStatusCode.Created);
            var orderId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

            var line = await ReadSingleLineAsync(orderId);
            line.UnitPrice.Should().Be(expected);
            line.UnitPrice.Should().Be(499.00m);
        }
        finally
        {
            _client.DefaultRequestHeaders.Authorization = null;
        }
    }
}
