using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Places.Common;
using AbrisAutoOutaouais_WebApp.Application.Places.Queries.LookupPostalCode;
using AbrisAutoOutaouais_WebApp.Application.Places.Queries.SuggestAddresses;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

/// <summary>
/// Proxy d'adresses (autocomplétion + résolution de code postal). Endpoints publics, mais
/// limités en débit (politique « places ») pour protéger le fournisseur externe et éviter
/// l'abus. La logique de fournisseur vit dans l'Infrastructure ; ce contrôleur ne fait que
/// dispatcher vers les queries CQRS.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[AllowAnonymous]
[EnableRateLimiting("places")]
public sealed class PlacesController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Autocomplétion d'adresse à partir d'un texte saisi.</summary>
    [HttpGet("suggest")]
    [ProducesResponseType<IReadOnlyList<PlaceSuggestionDto>>(200)]
    [ProducesResponseType<ProblemDetails>(422)]
    [ProducesResponseType(429)]
    public async Task<IActionResult> Suggest(
        // « query » est volontairement nullable au niveau de la liaison : une valeur vide ou
        // absente doit franchir le binding pour être rejetée par le ValidationBehavior en 422
        // (cohérent avec le reste de l'API), et non en 400 par la validation implicite
        // d'[ApiController] sur un paramètre référence non-nullable.
        [FromQuery] string? query = null,
        [FromQuery] string? city = null,
        [FromQuery] string? province = null,
        CancellationToken ct = default)
        => Ok(await dispatcher.DispatchAsync(new SuggestAddressesQuery(query ?? string.Empty, city, province), ct));

    /// <summary>Résolution du code postal pour une adresse civique complète.</summary>
    [HttpGet("lookup-postal-code")]
    [ProducesResponseType(200)]
    [ProducesResponseType(429)]
    public async Task<IActionResult> LookupPostalCode(
        [FromQuery] string civicNumber,
        [FromQuery] string street,
        [FromQuery] string city,
        [FromQuery] string province,
        CancellationToken ct = default)
    {
        var postalCode = await dispatcher.DispatchAsync(
            new LookupPostalCodeQuery(civicNumber, street, city, province), ct);
        return Ok(new { postalCode });
    }
}
