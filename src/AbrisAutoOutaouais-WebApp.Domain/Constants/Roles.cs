using AbrisAutoOutaouais_WebApp.Domain.Interfaces;

namespace AbrisAutoOutaouais_WebApp.Domain.Constants;

/// <summary>
/// Constantes de rôles métier — dans Domain pour être accessible depuis toutes les couches
/// sans violer les règles de dépendance (Application, Infrastructure, Api dépendent de Domain).
/// </summary>
public static class Roles
{
    public const string Customer = nameof(Customer);
    public const string Staff = nameof(Staff);
    public const string Admin = nameof(Admin);

    // Combinaisons pour [Authorize(Roles = ...)]
    public const string StaffOrAbove = $"{Staff},{Admin}";
    public const string All = $"{Customer},{Staff},{Admin}";
}
