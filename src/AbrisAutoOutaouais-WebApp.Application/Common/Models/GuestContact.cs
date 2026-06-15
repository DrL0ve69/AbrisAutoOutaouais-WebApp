namespace AbrisAutoOutaouais_WebApp.Application.Common.Models;

/// <summary>
/// Coordonnées d'un visiteur non connecté saisies à la confirmation d'un achat / d'une location /
/// d'une réservation. Sert à trouver-ou-créer un « compte express » passwordless rattaché par
/// courriel (voir <see cref="Common.Interfaces.IExpressAccountService"/>). N'inclut PAS l'adresse :
/// celle-ci reste validée par la source canonique unique <c>AddressDtoValidator</c> (leçon L-004).
/// </summary>
public sealed record GuestContact(string FirstName, string LastName, string Email, string? Phone);
