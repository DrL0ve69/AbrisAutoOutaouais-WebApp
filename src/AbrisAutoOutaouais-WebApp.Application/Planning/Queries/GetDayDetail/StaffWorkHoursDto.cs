namespace AbrisAutoOutaouais_WebApp.Application.Planning.Queries.GetDayDetail;

/// <summary>
/// Heures d'un employé (rôle Staff) pour un jour donné, telles que le planning les affiche.
/// <see cref="HasEntry"/> distingue « aucune ligne pour ce jour » (n'a pas travaillé) d'une ligne
/// présente aux heures nulles (« présent, horaire non précisé »). Les minutes sont en fuseau LOCAL
/// depuis minuit (L-044).
/// </summary>
public sealed record StaffWorkHoursDto(
    Guid EmployeeId,
    string FullName,
    int? StartMinutes,
    int? EndMinutes,
    string? Note,
    bool HasEntry);
