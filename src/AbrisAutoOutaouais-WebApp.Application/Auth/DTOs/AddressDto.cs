namespace AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;

/// <summary>DTO partagé — utilisé dans les commandes et les réponses de profil.</summary>
public sealed record AddressDto(
    string CivicNumber,
    string Street,
    string? Apartment,
    string City,
    string Province,
    string PostalCode,
    string Country = "Canada");
