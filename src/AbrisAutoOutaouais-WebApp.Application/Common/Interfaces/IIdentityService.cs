using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Service d'authentification, d'autorisation et de gestion du profil.
/// </summary>
public interface IIdentityService
{
    /// <summary>Enregistre un nouvel utilisateur (courriel + nom d'utilisateur uniques).</summary>
    Task<Result<AuthResponse>> RegisterAsync(
        string email,
        string username,
        string password,
        string firstName,
        string lastName,
        CancellationToken cancellationToken = default);

    /// <summary>Connexion par courriel OU nom d'utilisateur.</summary>
    Task<Result<AuthResponse>> LoginAsync(
        string identifier,
        string password,
        CancellationToken cancellationToken = default);

    /// <summary>Génère un nouveau JWT token pour un utilisateur.</summary>
    Task<string> GenerateTokenAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Assigne un rôle à un utilisateur.</summary>
    Task<Result> AssignRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default);

    /// <summary>Retire un rôle d'un utilisateur.</summary>
    Task<Result> RemoveRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default);

    /// <summary>Récupère les rôles d'un utilisateur.</summary>
    Task<IReadOnlyList<string>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Profil complet d'un utilisateur (null si introuvable).</summary>
    Task<UserProfileDto?> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Tous les utilisateurs (réservé à l'administration), du plus récent au plus ancien.</summary>
    Task<IReadOnlyList<AdminUserDto>> GetAllUsersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Tous les employés (utilisateurs de rôle <c>Staff</c>), triés par nom complet (US-11.2 planning).
    /// Permet à la couche Application d'énumérer les employés sans référencer <c>AppUser</c> (frontière).
    /// </summary>
    Task<IReadOnlyList<StaffMemberDto>> GetStaffMembersAsync(CancellationToken cancellationToken = default);

    /// <summary>Met à jour les informations de profil.</summary>
    Task<Result> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);

    /// <summary>Définit (ou retire si <paramref name="avatarUrl"/> est null) la photo de profil.</summary>
    Task<Result> UpdateAvatarAsync(Guid userId, string? avatarUrl, CancellationToken cancellationToken = default);

    /// <summary>Change le mot de passe.</summary>
    Task<Result> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken = default);

    /// <summary>
    /// Génère un jeton de réinitialisation du mot de passe pour le courriel donné.
    /// Échec si aucun compte ne correspond (l'appelant décide de rester silencieux —
    /// anti-énumération de comptes).
    /// </summary>
    Task<Result<string>> GeneratePasswordResetTokenAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>Réinitialise le mot de passe à partir d'un jeton de réinitialisation valide.</summary>
    Task<Result> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken cancellationToken = default);

    /// <summary>
    /// Indique si un nom d'utilisateur est déjà pris (aide à l'inscription, H5).
    /// </summary>
    Task<bool> IsUsernameTakenAsync(string username, CancellationToken cancellationToken = default);

    /// <summary>
    /// Indique si un courriel est déjà associé à un compte (aide à l'inscription, H5).
    /// </summary>
    Task<bool> IsEmailTakenAsync(string email, CancellationToken cancellationToken = default);
}

/// <summary>
/// Réponse d'authentification contenant le token JWT et les infos utilisateur.
/// </summary>
public sealed record AuthResponse(
    Guid UserId,
    string Email,
    string Username,
    string FirstName,
    string LastName,
    string FullName,
    string Token,
    IReadOnlyList<string> Roles,
    string? Avatar = null);
