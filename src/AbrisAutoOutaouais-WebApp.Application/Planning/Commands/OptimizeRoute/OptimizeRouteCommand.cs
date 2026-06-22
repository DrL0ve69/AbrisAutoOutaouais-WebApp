using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Planning.Commands.OptimizeRoute;

/// <summary>
/// Optimise la tournée des RDV (Pending/Confirmed) d'une journée (US-11.3) : réordonne par plus
/// proche voisin depuis la base de service et réécrit les heures (<c>SlotStart</c>) sur la grille de
/// créneaux. Réservé à l'Admin (validation visuelle du résultat). Mutation d'état → <c>ICommand</c>.
/// </summary>
public sealed record OptimizeRouteCommand(DateOnly Date) : ICommand<OptimizeRouteResultDto>;
