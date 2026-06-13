using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Auth.CheckAvailability;

/// <summary>
/// Vérifie la disponibilité d'un nom d'utilisateur et/ou d'un courriel à
/// l'inscription. Aide UX (H5) : révéler « pris/libre » est l'objectif assumé,
/// l'anti-énumération n'a donc pas lieu d'être ici (contrairement à
/// forgot-password). Chaque paramètre est optionnel : seul un paramètre
/// fourni (non vide) est évalué — sinon sa disponibilité reste <c>null</c>.
/// </summary>
public sealed record CheckAvailabilityQuery(
    string? Username,
    string? Email) : IQuery<AvailabilityDto>;

/// <summary>
/// Disponibilité de chaque identifiant demandé. <c>null</c> = non demandé
/// (paramètre absent ou vide), <c>true</c> = disponible, <c>false</c> = déjà pris.
/// </summary>
public sealed record AvailabilityDto(
    bool? UsernameAvailable,
    bool? EmailAvailable);

public sealed class CheckAvailabilityQueryHandler(IIdentityService identityService)
    : IQueryHandler<CheckAvailabilityQuery, AvailabilityDto>
{
    public async Task<AvailabilityDto> HandleAsync(
        CheckAvailabilityQuery query, CancellationToken cancellationToken = default)
    {
        bool? usernameAvailable = string.IsNullOrWhiteSpace(query.Username)
            ? null
            : !await identityService.IsUsernameTakenAsync(query.Username, cancellationToken);

        bool? emailAvailable = string.IsNullOrWhiteSpace(query.Email)
            ? null
            : !await identityService.IsEmailTakenAsync(query.Email, cancellationToken);

        return new AvailabilityDto(usernameAvailable, emailAvailable);
    }

    // Contrat IQueryHandler — délègue à HandleAsync (appelé par le Dispatcher).
    public ValueTask<AvailabilityDto> Handle(CheckAvailabilityQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
