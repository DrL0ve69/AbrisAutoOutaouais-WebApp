using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Implémentation de IIdentityService — gère l'authentification et l'autorisation.
/// </summary>
public sealed class IdentityService : IIdentityService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<AppRole> _roleManager;
    private readonly TokenService _tokenService;

    public IdentityService(
        UserManager<AppUser> userManager,
        RoleManager<AppRole> roleManager,
        TokenService tokenService)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _tokenService = tokenService;
    }

    public async Task<Result<AuthResponse>> RegisterAsync(
        string email,
        string password,
        string firstName,
        string lastName,
        CancellationToken cancellationToken = default)
    {
        // Vérifier si l'utilisateur existe déjà
        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser is not null)
        {
            return Result<AuthResponse>.Failure("Un utilisateur avec cet email existe déjà.");
        }

        // Créer le nouvel utilisateur
        var user = new AppUser
        {
            Email = email,
            UserName = email,
            FirstName = firstName,
            LastName = lastName,
            EmailConfirmed = true, // Assume l'email est confirmé pour la démo
            CreatedAt = DateTime.UtcNow,
        };

        var result = await _userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return Result<AuthResponse>.Failure($"Erreur lors de la création de l'utilisateur: {errors}");
        }

        // Assigner le rôle Customer par défaut
        await _userManager.AddToRoleAsync(user, "Customer");

        // Générer le token
        var roles = (await _userManager.GetRolesAsync(user)).ToList().AsReadOnly();
        var token = _tokenService.GenerateToken(user, roles);

        var response = new AuthResponse(
            user.Id,
            user.Email!,
            user.FirstName,
            user.LastName,
            user.FullName,
            token,
            roles);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<AuthResponse>> LoginAsync(
        string email,
        string password,
        CancellationToken cancellationToken = default)
    {
        // Chercher l'utilisateur
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return Result<AuthResponse>.Failure("Email ou mot de passe incorrect.");
        }

        // Vérifier le mot de passe
        var isPasswordValid = await _userManager.CheckPasswordAsync(user, password);
        if (!isPasswordValid)
        {
            return Result<AuthResponse>.Failure("Email ou mot de passe incorrect.");
        }

        // Générer le token
        var roles = (await _userManager.GetRolesAsync(user)).ToList().AsReadOnly();
        var token = _tokenService.GenerateToken(user, roles);

        var response = new AuthResponse(
            user.Id,
            user.Email!,
            user.FirstName,
            user.LastName,
            user.FullName,
            token,
            roles);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<string> GenerateTokenAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            throw new InvalidOperationException("Utilisateur introuvable.");
        }

        var roles = (await _userManager.GetRolesAsync(user)).ToList().AsReadOnly();
        return _tokenService.GenerateToken(user, roles);
    }

    public async Task<Result> AssignRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Failure("Utilisateur introuvable.");
        }

        var roleExists = await _roleManager.RoleExistsAsync(role);
        if (!roleExists)
        {
            return Result.Failure($"Le rôle '{role}' n'existe pas.");
        }

        var result = await _userManager.AddToRoleAsync(user, role);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return Result.Failure($"Erreur lors de l'assignation du rôle: {errors}");
        }

        return Result.Success();
    }

    public async Task<Result> RemoveRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Result.Failure("Utilisateur introuvable.");
        }

        var result = await _userManager.RemoveFromRoleAsync(user, role);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return Result.Failure($"Erreur lors du retrait du rôle: {errors}");
        }

        return Result.Success();
    }

    public async Task<IReadOnlyList<string>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return [];
        }

        var roles = await _userManager.GetRolesAsync(user);
        return roles.ToList().AsReadOnly();
    }

    //Task<Result<AuthResponse>> IIdentityService.RegisterAsync(string email, string password, string firstName, string lastName, CancellationToken cancellationToken)
    //{
    //    throw new NotImplementedException();
    //}

    //Task<Result<AuthResponse>> IIdentityService.LoginAsync(string email, string password, CancellationToken cancellationToken)
    //{
    //    throw new NotImplementedException();
    //}

    //Task<Result> IIdentityService.AssignRoleAsync(Guid userId, string role, CancellationToken cancellationToken)
    //{
    //    throw new NotImplementedException();
    //}

    //Task<Result> IIdentityService.RemoveRoleAsync(Guid userId, string role, CancellationToken cancellationToken)
    //{
    //    throw new NotImplementedException();
    //}
}
