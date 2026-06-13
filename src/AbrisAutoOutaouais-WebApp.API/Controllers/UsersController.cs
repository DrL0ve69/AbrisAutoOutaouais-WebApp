using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Users.Queries.GetAllUsers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize(Policy = "AdminOnly")] // gestion des comptes — réservée à l'administration
public sealed class UsersController(IDispatcher dispatcher) : ControllerBase
{
    /// <summary>Tous les utilisateurs (Admin).</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<AdminUserDto>>(200)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await dispatcher.DispatchAsync(new GetAllUsersQuery(), ct));
}
