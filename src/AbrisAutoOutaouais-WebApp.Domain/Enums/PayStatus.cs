namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

/// <summary>
/// Statut de paie d'une journée travaillée (<c>WorkHoursEntry</c>) — INFORMATIF uniquement
/// (EPIC 8, US-8.1) : aucune déduction, taxe ni virement n'est calculé. Identifiants C# en anglais
/// sans accent (idiome <see cref="RentalStatus"/> / <c>OrderStatus</c>) ; persisté en string via
/// <c>HasConversion&lt;string&gt;</c>. Défaut <see cref="AnsPayer"/> à la création.
/// </summary>
public enum PayStatus
{
    /// <summary>Heures saisies mais pas encore marquées comme payées (défaut).</summary>
    AnsPayer = 0,

    /// <summary>L'administrateur a marqué la paie comme versée pour cette journée.</summary>
    Payee = 1,
}
