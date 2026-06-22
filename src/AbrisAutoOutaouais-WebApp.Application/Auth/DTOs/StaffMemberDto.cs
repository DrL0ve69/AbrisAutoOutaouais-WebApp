namespace AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;

/// <summary>
/// Employé (utilisateur de rôle <c>Staff</c>) projeté pour le planning (US-11.2) — juste son
/// identité et son nom complet. La couche Application énumère les employés via
/// <c>IIdentityService.GetStaffMembersAsync</c> et ne référence jamais <c>AppUser</c>
/// (qui vit dans Infrastructure) — respect des frontières Clean Architecture / DIP.
/// </summary>
public sealed record StaffMemberDto(Guid Id, string FullName);
