namespace AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;

/// <summary>
/// Résultat de recherche d'un client (utilisateur de rôle <c>Customer</c>) projeté pour la saisie
/// d'un RDV depuis le calendrier admin (US-11.2) — identité, nom complet et courriel pour
/// désambiguïser deux homonymes. La couche Application énumère les clients via
/// <c>IIdentityService.SearchCustomersAsync</c> et ne référence jamais <c>AppUser</c>
/// (qui vit dans Infrastructure) — respect des frontières Clean Architecture / DIP.
/// </summary>
public sealed record CustomerSearchResultDto(Guid Id, string FullName, string Email);
