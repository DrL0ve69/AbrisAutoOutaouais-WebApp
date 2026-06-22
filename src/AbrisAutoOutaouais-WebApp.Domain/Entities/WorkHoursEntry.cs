using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Domain.Interfaces;

namespace AbrisAutoOutaouais_WebApp.Domain.Entities;

/// <summary>
/// Heures travaillées d'un employé (rôle <c>Staff</c>) pour un jour donné (US-11.2).
///
/// Entité RÉGULIÈRE et AUTONOME (sa propre table + son propre DbSet) — JAMAIS un type owned d'un
/// agrégat : EF InMemory (utilisé en tests d'intégration) lève une DbUpdateConcurrencyException
/// quand on remplace les enfants owned d'un agrégat suivi (leçon L-035). Le couple
/// (<see cref="EmployeeId"/>, <see cref="WorkDate"/>) est unique : il identifie « la journée de
/// travail de cet employé ». L'EXISTENCE d'une ligne signifie « a travaillé ce jour-là » ; les
/// heures peuvent rester nulles (« présent, horaire non précisé »).
///
/// Les heures sont stockées en MINUTES depuis minuit, dans le fuseau LOCAL de la journée de
/// travail (l'entreprise opère un seul fuseau régional). Aucune <c>DateTime</c> UTC ici → robuste
/// au changement d'heure (DST) et cohérent avec l'affichage local partout dans l'app (L-044).
/// </summary>
public sealed class WorkHoursEntry : IAuditableEntity, ISoftDeletable
{
    /// <summary>Borne supérieure exclusive des minutes dans une journée (24 h × 60).</summary>
    public const int MinutesPerDay = 24 * 60;

    public Guid Id { get; private set; }

    /// <summary>Identifiant de l'employé (<c>AppUser.Id</c>, rôle Staff).</summary>
    public Guid EmployeeId { get; private set; }

    /// <summary>Jour travaillé (date locale, sans heure ni fuseau).</summary>
    public DateOnly WorkDate { get; private set; }

    /// <summary>Début de journée en minutes depuis minuit (local), ou <c>null</c> si non précisé.</summary>
    public int? StartMinutes { get; private set; }

    /// <summary>Fin de journée en minutes depuis minuit (local), ou <c>null</c> si non précisée.</summary>
    public int? EndMinutes { get; private set; }

    /// <summary>Note libre facultative (≤ 500 caractères).</summary>
    public string? Note { get; private set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }

    private WorkHoursEntry() { }

    /// <summary>
    /// Crée une journée de travail pour un employé. Valide les bornes horaires (cf.
    /// <see cref="UpdateHours"/>).
    /// </summary>
    public static WorkHoursEntry Create(
        Guid employeeId, DateOnly workDate, int? startMinutes, int? endMinutes, string? note = null)
    {
        if (employeeId == Guid.Empty)
            throw new BusinessRuleException("L'identifiant de l'employé est requis.");

        ValidateHours(startMinutes, endMinutes);

        return new WorkHoursEntry
        {
            Id = Guid.NewGuid(),
            EmployeeId = employeeId,
            WorkDate = workDate,
            StartMinutes = startMinutes,
            EndMinutes = endMinutes,
            Note = NormalizeNote(note),
        };
    }

    /// <summary>
    /// Met à jour les heures (et la note) d'une journée existante. Chaque borne présente doit
    /// tomber dans [0, 1440[ ; si les deux sont présentes, la fin doit être strictement après le
    /// début. <c>null</c> est valide pour l'une ou l'autre (« présent, horaire non précisé »).
    /// </summary>
    public void UpdateHours(int? startMinutes, int? endMinutes, string? note = null)
    {
        ValidateHours(startMinutes, endMinutes);
        StartMinutes = startMinutes;
        EndMinutes = endMinutes;
        Note = NormalizeNote(note);
    }

    private static void ValidateHours(int? startMinutes, int? endMinutes)
    {
        if (startMinutes is < 0 or >= MinutesPerDay)
            throw new BusinessRuleException("L'heure de début doit être comprise entre 00:00 et 23:59.");
        if (endMinutes is < 0 or >= MinutesPerDay)
            throw new BusinessRuleException("L'heure de fin doit être comprise entre 00:00 et 23:59.");
        if (startMinutes is not null && endMinutes is not null && endMinutes <= startMinutes)
            throw new BusinessRuleException("L'heure de fin doit être postérieure à l'heure de début.");
    }

    private static string? NormalizeNote(string? note)
        => string.IsNullOrWhiteSpace(note) ? null : note.Trim();
}
