using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.CreateShelterModel;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.DeleteShelterModel;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Commands.UpdateShelterModel;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModels;
using AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterPrice;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

/// <summary>
/// Catalogue des modèles d'abris PARAMÉTRIQUES (EPIC 9) : liste, détail par slug et calcul de prix
/// pour une longueur configurée. Lecture seule et publique (<c>[AllowAnonymous]</c>) — alimente le
/// configurateur côté client. Le contrôleur ne fait que dispatcher (pas de logique métier).
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class SheltersController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Liste les modèles d'abris, filtrables par slug de catégorie (<c>?category=</c>).</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<ShelterModelSummaryDto>>(200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? category = null, CancellationToken ct = default)
        => Ok(await dispatcher.DispatchAsync(new GetShelterModelsQuery(category), ct));

    /// <summary>
    /// Calcule le prix d'un modèle pour une longueur configurée (en cm). Le segment littéral
    /// « price » l'emporte sur le paramètre <c>{slug}</c> par précédence de gabarit de route (un
    /// template plus spécifique prime) ; on le déclare AVANT par lisibilité, et un test IT verrouille
    /// le comportement. Longueur hors plage / désalignée → 422 ; slug inconnu → 404.
    /// </summary>
    [HttpGet("{slug}/price")]
    [AllowAnonymous]
    [ProducesResponseType<ShelterPriceDto>(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> GetPrice(
        string slug, [FromQuery] int lengthCm, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetShelterPriceQuery(slug, lengthCm), ct));

    /// <summary>Détail d'un modèle par slug (incl. options de largeur et de hauteur dégagée).</summary>
    [HttpGet("{slug}")]
    [AllowAnonymous]
    [ProducesResponseType<ShelterModelDetailDto>(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetShelterModelBySlugQuery(slug), ct));

    /// <summary>Créer un modèle d'abri paramétrique (Admin).</summary>
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(201)]
    [ProducesResponseType<ProblemDetails>(409)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Create(
        [FromBody] CreateShelterModelCommand cmd, CancellationToken ct)
    {
        var id = await dispatcher.DispatchAsync(cmd, ct);
        // On dispose ICI du vrai slug (dans la commande) — on l'utilise pour le Location header
        // (forme canonique normalisée comme le domaine), plutôt que le raccourci slug = id.
        return CreatedAtAction(
            nameof(GetBySlug),
            new { slug = cmd.Slug.Trim().ToLowerInvariant(), version = "1.0" },
            new { id });
    }

    /// <summary>Reconfigurer un modèle d'abri — slug immuable (Admin).</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    [ProducesResponseType<ProblemDetails>(422)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateShelterModelCommand cmd, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(cmd with { Id = id }, ct);
        return NoContent();
    }

    /// <summary>Supprimer un modèle d'abri — soft delete (Admin).</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    [ProducesResponseType(204)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await dispatcher.DispatchAsync(new DeleteShelterModelCommand(id), ct);
        return NoContent();
    }
}
