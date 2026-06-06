using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetAllProducts;
using AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class ProductsController(Dispatcher dispatcher) : ControllerBase
{
    /// <summary>Liste paginée + filtres.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<PaginatedList<ProductDto>>(200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 12,
        [FromQuery] string? category = null, [FromQuery] string? search = null,
        CancellationToken ct = default)
        => Ok(await dispatcher.Query(new GetAllProductsQuery(page, pageSize, category, search), ct));

    /// <summary>Détail par slug (URL SEO-friendly).</summary>
    [HttpGet("{slug}")]
    [AllowAnonymous]
    [ProducesResponseType<ProductDto>(200)]
    [ProducesResponseType<ProblemDetails>(404)]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
        => Ok(await dispatcher.Query(new GetProductBySlugQuery(slug), ct));

    /// <summary>Créer un produit.</summary>
    //[HttpPost]
    //[Authorize(Roles = Roles.Admin)]
    //[ProducesResponseType<Guid>(201)]
    //[ProducesResponseType<ProblemDetails>(422)]
    //public async Task<IActionResult> Create(
    //    [FromBody] CreateProductCommand cmd, CancellationToken ct)
    //{
    //    var id = await dispatcher.Send(cmd, ct);
    //    return CreatedAtAction(nameof(GetBySlug),
    //        new { slug = cmd.Slug, version = "1.0" }, id);
    //}

    ///// <summary>Mettre à jour un produit.</summary>
    //[HttpPut("{id:guid}")]
    //[Authorize(Roles = Roles.Admin)]
    //[ProducesResponseType(204)]
    //public async Task<IActionResult> Update(
    //    Guid id, [FromBody] UpdateProductCommand cmd, CancellationToken ct)
    //{
    //    await dispatcher.Send(cmd with { Id = id }, ct);
    //    return NoContent();
    //}

    ///// <summary>Supprimer un produit (soft delete).</summary>
    //[HttpDelete("{id:guid}")]
    //[Authorize(Roles = Roles.Admin)]
    //[ProducesResponseType(204)]
    //public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    //{
    //    await dispatcher.Send(new DeleteProductCommand(id), ct);
    //    return NoContent();
    //}
}
