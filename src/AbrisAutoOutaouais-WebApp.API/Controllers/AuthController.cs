using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Auth.ForgotPassword;
using AbrisAutoOutaouais_WebApp.Application.Auth.Login;
using AbrisAutoOutaouais_WebApp.Application.Auth.Register;
using AbrisAutoOutaouais_WebApp.Application.Auth.ResetPassword;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AbrisAutoOutaouais_WebApp.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IDispatcher _dispatcher;
    private readonly IIdentityService _identity;
    private readonly ICurrentUserService _currentUser;
    private readonly IFileStorageService _fileStorage;

    public AuthController(
        IDispatcher dispatcher,
        IIdentityService identity,
        ICurrentUserService currentUser,
        IFileStorageService fileStorage)
    {
        _dispatcher = dispatcher;
        _identity = identity;
        _currentUser = currentUser;
        _fileStorage = fileStorage;
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

    /// <summary>Demande l'envoi d'un lien de réinitialisation du mot de passe.</summary>
    // TODO(Epic C): rate-limit — endpoint anonyme et coûteux (génération de jeton +
    // envoi de courriel), à protéger contre l'abus quand le limiteur d'Epic C arrive.
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        // Anti-énumération : toujours 202 Accepted, que le compte existe ou non.
        await _dispatcher.DispatchAsync(request, cancellationToken);
        return Accepted();
    }

    /// <summary>Réinitialise le mot de passe à partir du jeton reçu par courriel.</summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var result = await _dispatcher.DispatchAsync(request, cancellationToken);

        return result.IsSuccess
            ? NoContent()
            : BadRequest(new { error = result.Error });
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

    /// <summary>Téléverse (ou remplace) la photo de profil de l'utilisateur connecté.</summary>
    [HttpPost("me/avatar")]
    [Authorize]
    public async Task<IActionResult> UploadAvatar(IFormFile file, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } userId) return Unauthorized();
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Aucun fichier fourni." });

        // L'ancienne photo est supprimée seulement après la mise à jour réussie.
        var current = await _identity.GetProfileAsync(userId, cancellationToken);

        string url;
        await using (var stream = file.OpenReadStream())
        {
            // La validation (type, taille) est faite par IFileStorageService.
            url = await _fileStorage.SaveAsync(
                stream, file.FileName, file.ContentType, "avatars", cancellationToken);
        }

        var result = await _identity.UpdateAvatarAsync(userId, url, cancellationToken);
        if (!result.IsSuccess)
        {
            await _fileStorage.DeleteAsync(url, cancellationToken);
            return BadRequest(new { error = result.Error });
        }

        if (!string.IsNullOrEmpty(current?.Avatar))
            await _fileStorage.DeleteAsync(current.Avatar, cancellationToken);

        var profile = await _identity.GetProfileAsync(userId, cancellationToken);
        return Ok(profile);
    }

    /// <summary>Retire la photo de profil de l'utilisateur connecté.</summary>
    [HttpDelete("me/avatar")]
    [Authorize]
    public async Task<IActionResult> RemoveAvatar(CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } userId) return Unauthorized();

        var current = await _identity.GetProfileAsync(userId, cancellationToken);

        var result = await _identity.UpdateAvatarAsync(userId, null, cancellationToken);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        if (!string.IsNullOrEmpty(current?.Avatar))
            await _fileStorage.DeleteAsync(current.Avatar, cancellationToken);

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
