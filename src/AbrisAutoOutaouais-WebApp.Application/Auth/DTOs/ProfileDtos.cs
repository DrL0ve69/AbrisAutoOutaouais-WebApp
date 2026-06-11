namespace AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;

/// <summary>Profil complet renvoyé par GET /auth/me.</summary>
public sealed record UserProfileDto(
    Guid Id,
    string Email,
    string Username,
    string FirstName,
    string LastName,
    string? PhoneNumber,
    string? Avatar,
    string PreferredLanguage,
    AddressDto? DefaultDeliveryAddress,
    DateTime CreatedAt,
    IReadOnlyList<string> Roles);

/// <summary>Corps de PUT /auth/me.</summary>
public sealed record UpdateProfileRequest(
    string FirstName,
    string LastName,
    string? PhoneNumber,
    string PreferredLanguage,
    AddressDto? DefaultDeliveryAddress);

/// <summary>Corps de POST /auth/me/change-password.</summary>
public sealed record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);
