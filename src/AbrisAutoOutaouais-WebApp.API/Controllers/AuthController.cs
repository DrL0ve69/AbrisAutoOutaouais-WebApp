using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
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
    private readonly IIdentityService _identity;
    private readonly ICurrentUserService _currentUser;

    public AuthController(
        IDispatcher dispatcher,
        IIdentityService identity,
        ICurrentUserService currentUser)
    {
        _dispatcher = dispatcher;
        _identity = identity;
        _currentUser = currentUser;
    }

    /// <summary>Enregistre un nouvel utilisateur.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(
        [FromBody] RegisterCommand request, CancellationToken cancellationToken)
    {
        var command = new RegisterCommand(
            request.Email,
            request.Username,
            request.Password,
            request.ConfirmPassword,
            request.FirstName,
            request.LastName);

        var result = await _dispatcher.DispatchAsync(command, cancellationToken);

        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    /// <summary>Connecte un utilisateur (courriel ou nom d'utilisateur).</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(
        [FromBody] LoginCommand request, CancellationToken cancellationToken)
    {
        var command = new LoginCommand(request.Email, request.Password);
        var result = await _dispatcher.DispatchAsync(command, cancellationToken);

        return result.IsSuccess
            ? Ok(result.Value)
            : Unauthorized(new { error = result.Error });
    }

    /// <summary>Profil complet de l'utilisateur connecté.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } userId) return Unauthorized();
        var profile = await _identity.GetProfileAsync(userId, cancellationToken);
        return profile is null ? NotFound() : Ok(profile);
    }

    /// <summary>Met à jour le profil de l'utilisateur connecté.</summary>
    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } userId) return Unauthorized();

        var result = await _identity.UpdateProfileAsync(userId, request, cancellationToken);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        var profile = await _identity.GetProfileAsync(userId, cancellationToken);
        return Ok(profile);
    }

    /// <summary>Change le mot de passe de l'utilisateur connecté.</summary>
    [HttpPost("me/change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } userId) return Unauthorized();

        var result = await _identity.ChangePasswordAsync(
            userId, request.CurrentPassword, request.NewPassword, cancellationToken);

        return result.IsSuccess
            ? NoContent()
            : BadRequest(new { error = result.Error });
    }
}
