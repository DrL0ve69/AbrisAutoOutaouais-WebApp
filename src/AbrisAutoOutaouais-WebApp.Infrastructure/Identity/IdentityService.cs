using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using Domain.ValueObjects;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Implémentation de IIdentityService — gère l'authentification, l'autorisation et le profil.
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
        string email, string username, string password,
        string firstName, string lastName, CancellationToken cancellationToken = default)
    {
        if (await _userManager.FindByEmailAsync(email) is not null)
            return Result<AuthResponse>.Failure("Un utilisateur avec ce courriel existe déjà.");

        if (await _userManager.FindByNameAsync(username) is not null)
            return Result<AuthResponse>.Failure("Ce nom d'utilisateur est déjà pris.");

        var user = new AppUser
        {
            Email = email,
            UserName = username,
            FirstName = firstName,
            LastName = lastName,
            EmailConfirmed = true, // Démo : courriel considéré confirmé
            CreatedAt = DateTime.UtcNow,
        };

        var result = await _userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return Result<AuthResponse>.Failure($"Erreur lors de la création de l'utilisateur: {errors}");
        }

        await _userManager.AddToRoleAsync(user, "Customer");
        return Result<AuthResponse>.Success(await BuildAuthResponseAsync(user));
    }

    public async Task<Result<AuthResponse>> LoginAsync(
        string identifier, string password, CancellationToken cancellationToken = default)
    {
        // Connexion par courriel OU nom d'utilisateur
        var user = identifier.Contains('@')
            ? await _userManager.FindByEmailAsync(identifier)
            : await _userManager.FindByNameAsync(identifier);
        user ??= await _userManager.FindByEmailAsync(identifier);
        user ??= await _userManager.FindByNameAsync(identifier);

        if (user is null || !await _userManager.CheckPasswordAsync(user, password))
            return Result<AuthResponse>.Failure("Identifiants incorrects.");

        return Result<AuthResponse>.Success(await BuildAuthResponseAsync(user));
    }

    public async Task<string> GenerateTokenAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new InvalidOperationException("Utilisateur introuvable.");
        var roles = (await _userManager.GetRolesAsync(user)).ToList().AsReadOnly();
        return _tokenService.GenerateToken(user, roles);
    }

    public async Task<Result> AssignRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        if (!await _roleManager.RoleExistsAsync(role))
            return Result.Failure($"Le rôle '{role}' n'existe pas.");

        var result = await _userManager.AddToRoleAsync(user, role);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure($"Erreur lors de l'assignation du rôle: {string.Join(", ", result.Errors.Select(e => e.Description))}");
    }

    public async Task<Result> RemoveRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        var result = await _userManager.RemoveFromRoleAsync(user, role);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure($"Erreur lors du retrait du rôle: {string.Join(", ", result.Errors.Select(e => e.Description))}");
    }

    public async Task<IReadOnlyList<string>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return [];
        var roles = await _userManager.GetRolesAsync(user);
        return roles.ToList().AsReadOnly();
    }

    public async Task<UserProfileDto?> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return null;

        var roles = (await _userManager.GetRolesAsync(user)).ToList().AsReadOnly();

        AddressDto? address = user.DefaultDeliveryAddress is { } a
            ? new AddressDto(a.CivicNumber, a.Street, a.Apartment, a.City, a.Province, a.PostalCode, a.Country)
            : null;

        return new UserProfileDto(
            user.Id, user.Email!, user.UserName!, user.FirstName, user.LastName,
            user.PhoneNumber, user.Avatar, user.PreferredLanguage, address, user.CreatedAt, roles);
    }

    public async Task<IReadOnlyList<AdminUserDto>> GetAllUsersAsync(CancellationToken cancellationToken = default)
    {
        var users = await _userManager.Users
            .AsNoTracking()
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync(cancellationToken);

        var result = new List<AdminUserDto>(users.Count);
        foreach (var user in users)
        {
            var roles = (await _userManager.GetRolesAsync(user)).ToList().AsReadOnly();
            result.Add(new AdminUserDto(
                user.Id,
                user.Email ?? "—",
                user.UserName ?? "—",
                user.FullName,
                roles,
                user.CreatedAt,
                await _userManager.IsLockedOutAsync(user)));
        }

        return result;
    }

    public async Task<IReadOnlyList<StaffMemberDto>> GetStaffMembersAsync(
        CancellationToken cancellationToken = default)
    {
        var staff = await _userManager.GetUsersInRoleAsync(Roles.Staff);
        return staff
            .Select(u => new StaffMemberDto(u.Id, u.FullName))
            .OrderBy(s => s.FullName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    public async Task<IReadOnlyList<StaffPayRateDto>> GetStaffWithRatesAsync(
        CancellationToken cancellationToken = default)
    {
        var staff = await _userManager.GetUsersInRoleAsync(Roles.Staff);
        return staff
            .Select(u => new StaffPayRateDto(u.Id, u.FullName, u.HourlyRate))
            .OrderBy(s => s.FullName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    public async Task<Result> SetHourlyRateAsync(
        Guid employeeId, decimal? hourlyRate, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(employeeId.ToString());
        if (user is null) return Result.Failure("Employé introuvable.");

        // Le taux horaire n'a de sens que pour un membre du personnel (Staff).
        if (!await _userManager.IsInRoleAsync(user, Roles.Staff))
            return Result.Failure("L'utilisateur n'est pas un membre du personnel.");

        user.HourlyRate = hourlyRate;
        user.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(string.Join(", ", result.Errors.Select(e => e.Description)));
    }

    public async Task<IReadOnlyList<CustomerSearchResultDto>> SearchCustomersAsync(
        string term, int take, CancellationToken cancellationToken = default)
    {
        // Hypothèse : un compte Staff/Admin ne porte PAS aussi le rôle Customer — sinon il
        // apparaîtrait dans ce picker client (les rôles sont mutuellement exclusifs ici).
        var customers = await _userManager.GetUsersInRoleAsync(Roles.Customer);
        var trimmed = term.Trim();

        // Filtre en mémoire (collection déjà matérialisée par GetUsersInRoleAsync, comme pour le
        // staff) : nom complet OU courriel « contient » le terme, insensible à la casse. On exclut
        // les comptes express anonymes (créés en silence pour un invité, sans nom — Épic F) pour ne
        // pas polluer la liste de l'admin. `string.Contains` sur une VALEUR (pas une collection)
        // n'est pas concerné par le piège de traduction EF (L-038) — ici tout est en mémoire.
        return customers
            .Where(u => !(u.IsExpress
                && string.IsNullOrWhiteSpace(u.FirstName)
                && string.IsNullOrWhiteSpace(u.LastName)))
            .Where(u =>
                u.FullName.Contains(trimmed, StringComparison.CurrentCultureIgnoreCase)
                || (u.Email is not null
                    && u.Email.Contains(trimmed, StringComparison.CurrentCultureIgnoreCase)))
            .OrderBy(u => u.FullName, StringComparer.CurrentCultureIgnoreCase)
            .Take(take)
            .Select(u => new CustomerSearchResultDto(u.Id, u.FullName, u.Email ?? "—"))
            .ToList();
    }

    public async Task<Result> UpdateProfileAsync(
        Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.PhoneNumber = request.PhoneNumber;
        user.PreferredLanguage = string.IsNullOrWhiteSpace(request.PreferredLanguage)
            ? "fr"
            : request.PreferredLanguage;
        user.UpdatedAt = DateTime.UtcNow;

        var d = request.DefaultDeliveryAddress;
        user.DefaultDeliveryAddress =
            d is not null
            && !string.IsNullOrWhiteSpace(d.CivicNumber)
            && !string.IsNullOrWhiteSpace(d.Street)
            && !string.IsNullOrWhiteSpace(d.City)
            && !string.IsNullOrWhiteSpace(d.PostalCode)
                ? Address.Create(
                    d.CivicNumber, d.Street, d.Apartment, d.City,
                    string.IsNullOrWhiteSpace(d.Province) ? "QC" : d.Province,
                    d.PostalCode,
                    string.IsNullOrWhiteSpace(d.Country) ? "Canada" : d.Country)
                : null;

        var result = await _userManager.UpdateAsync(user);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(string.Join(", ", result.Errors.Select(e => e.Description)));
    }

    public async Task<Result> UpdateAvatarAsync(
        Guid userId, string? avatarUrl, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        user.Avatar = avatarUrl;
        user.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(string.Join(", ", result.Errors.Select(e => e.Description)));
    }

    public async Task<Result> ChangePasswordAsync(
        Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("Utilisateur introuvable.");

        var result = await _userManager.ChangePasswordAsync(user, currentPassword, newPassword);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(string.Join(", ", result.Errors.Select(e => e.Description)));
    }

    public async Task<Result<string>> GeneratePasswordResetTokenAsync(
        string email, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null) return Result<string>.Failure("Utilisateur introuvable.");

        // Jeton à durée limitée émis par le DataProtectorTokenProvider (AddDefaultTokenProviders).
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        return Result<string>.Success(token);
    }

    public async Task<Result> ResetPasswordAsync(
        string email, string token, string newPassword, CancellationToken cancellationToken = default)
    {
        // Message volontairement identique pour un compte inconnu et un jeton invalide :
        // la réponse ne doit pas permettre de déduire l'existence d'un compte.
        const string invalidLink = "Le lien de réinitialisation est invalide ou expiré.";

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null) return Result.Failure(invalidLink);

        var result = await _userManager.ResetPasswordAsync(user, token, newPassword);
        if (result.Succeeded) return Result.Success();

        // Jeton invalide/expiré → message générique ; autres erreurs (politique de mot de
        // passe…) → détails utiles à l'utilisateur, comme ChangePasswordAsync.
        return result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.InvalidToken))
            ? Result.Failure(invalidLink)
            : Result.Failure(string.Join(", ", result.Errors.Select(e => e.Description)));
    }

    public async Task<bool> IsUsernameTakenAsync(
        string username, CancellationToken cancellationToken = default)
        => await _userManager.FindByNameAsync(username) is not null;

    public async Task<bool> IsEmailTakenAsync(
        string email, CancellationToken cancellationToken = default)
        => await _userManager.FindByEmailAsync(email) is not null;

    private async Task<AuthResponse> BuildAuthResponseAsync(AppUser user)
    {
        var roles = (await _userManager.GetRolesAsync(user)).ToList().AsReadOnly();
        var token = _tokenService.GenerateToken(user, roles);
        return new AuthResponse(
            user.Id, user.Email!, user.UserName!, user.FirstName, user.LastName,
            user.FullName, token, roles, user.Avatar);
    }
}
