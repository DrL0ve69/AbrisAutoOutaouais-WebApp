using AbrisAutoOutaouais_WebApp.Application.Auth.Login;
using AbrisAutoOutaouais_WebApp.Application.Auth.Register;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IDispatcher _dispatcher;

    public AuthController(IDispatcher dispatcher)
    {
        _dispatcher = dispatcher;
    }

    /// <summary>
    /// Enregistre un nouvel utilisateur.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(
        [FromBody] RegisterCommand request,
        CancellationToken cancellationToken)
    {
        var command = new RegisterCommand(
            request.Email,
            request.Password,
            request.ConfirmPassword,
            request.FirstName,
            request.LastName);

        var result = await _dispatcher.DispatchAsync(command, cancellationToken);

        if (!result.IsSuccess)
        {
            return BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Connecte un utilisateur.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(
        [FromBody] LoginCommand request,
        CancellationToken cancellationToken)
    {
        var command = new LoginCommand(request.Email, request.Password);
        var result = await _dispatcher.DispatchAsync(command, cancellationToken);

        if (!result.IsSuccess)
        {
            return Unauthorized(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Récupère l'utilisateur actuel.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult GetCurrentUser([FromServices] ICurrentUserService currentUserService)
    {
        return Ok(new
        {
            userId = currentUserService.UserId,
            email = currentUserService.Email,
            roles = currentUserService.Roles,
        });
    }
}

