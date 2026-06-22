namespace AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;

/// <summary>
/// Employé (rôle <c>Staff</c>) avec son taux horaire CAD pour le récap de paie (EPIC 8, US-8.1).
/// <see cref="HourlyRate"/> est <c>null</c> quand le taux n'a pas été défini. La couche Application
/// énumère les employés et leurs taux via <c>IIdentityService.GetStaffWithRatesAsync</c> et ne
/// référence jamais <c>AppUser</c> (qui vit dans Infrastructure) — frontière Clean Architecture / DIP.
/// </summary>
public sealed record StaffPayRateDto(Guid Id, string FullName, decimal? HourlyRate);
