using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Users.Queries.GetAllUsers;

/// <summary>Tous les utilisateurs (réservé à l'administration), du plus récent au plus ancien.</summary>
public sealed record GetAllUsersQuery() : IQuery<IReadOnlyList<AdminUserDto>>;

internal sealed class GetAllUsersQueryHandler(IIdentityService identity)
    : IQueryHandler<GetAllUsersQuery, IReadOnlyList<AdminUserDto>>
{
    public Task<IReadOnlyList<AdminUserDto>> HandleAsync(GetAllUsersQuery query, CancellationToken ct)
        => identity.GetAllUsersAsync(ct);

    public ValueTask<IReadOnlyList<AdminUserDto>> Handle(GetAllUsersQuery query, CancellationToken ct)
        => new(HandleAsync(query, ct));
}
