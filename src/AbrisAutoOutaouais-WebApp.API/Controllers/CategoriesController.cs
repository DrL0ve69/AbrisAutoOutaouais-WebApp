using AbrisAutoOutaouais_WebApp.Application.Categories.Queries.GetAllCategories;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class CategoriesController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Liste toutes les catégories de produits (public).</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<CategoryDto>>(200)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetAllCategoriesQuery(), ct));
}
