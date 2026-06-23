using AbrisAutoOutaouais_WebApp.Application.Catalog.Queries.ResolveCatalogSlug;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

/// <summary>
/// Résolution du TYPE d'un slug de catalogue (modèle d'abri vs produit fixe). Lecture seule et
/// publique (<c>[AllowAnonymous]</c>) : la fiche détail côté client appelle ce résolveur AVANT de
/// charger la fiche, pour interroger le bon endpoint sans 404 spéculatif. Le contrôleur ne fait que
/// dispatcher (pas de logique métier).
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class CatalogController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>
    /// Indique si <paramref name="slug"/> désigne un modèle d'abri (<c>"shelter"</c>) ou un produit
    /// fixe (<c>"product"</c>). 404 si le slug n'existe dans aucun des deux référentiels.
    /// </summary>
    [HttpGet("{slug}/type")]
    [AllowAnonymous]
    [ProducesResponseType<CatalogSlugTypeDto>(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> GetType(string slug, CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new ResolveCatalogSlugQuery(slug), ct));
}
