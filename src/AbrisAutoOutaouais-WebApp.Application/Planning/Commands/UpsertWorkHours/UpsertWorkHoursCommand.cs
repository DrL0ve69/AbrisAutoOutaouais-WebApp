using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Commands.UpsertWorkHours;

/// <summary>
/// Crée ou met à jour les heures travaillées d'un employé pour une date (US-11.2, écriture Admin).
/// Upsert par le couple (<see cref="EmployeeId"/>, <see cref="Date"/>). Les minutes sont en fuseau
/// LOCAL depuis minuit ; <c>null</c> est valide (« présent, horaire non précisé »). Retourne l'Id
/// de la ligne (créée ou existante).
/// </summary>
public sealed record UpsertWorkHoursCommand(
    Guid EmployeeId,
    DateOnly Date,
    int? StartMinutes,
    int? EndMinutes,
    string? Note) : ICommand<Guid>;
