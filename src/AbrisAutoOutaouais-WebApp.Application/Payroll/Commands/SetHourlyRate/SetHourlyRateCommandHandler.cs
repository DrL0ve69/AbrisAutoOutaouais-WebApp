using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;

namespace AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.SetHourlyRate;

/// <summary>
/// Définit le taux horaire d'un employé (EPIC 8, US-8.1) via
/// <see cref="IIdentityService.SetHourlyRateAsync"/> (frontière : l'Application ne référence pas
/// <c>AppUser</c>). Un employé introuvable ou non-<c>Staff</c> remonte un échec → 404.
/// </summary>
internal sealed class SetHourlyRateCommandHandler(IIdentityService identity)
    : ICommandHandler<SetHourlyRateCommand, Unit>
{
    public async Task<Unit> HandleAsync(SetHourlyRateCommand command, CancellationToken ct)
    {
        var result = await identity.SetHourlyRateAsync(command.EmployeeId, command.HourlyRate, ct);
        if (!result.IsSuccess)
            throw new NotFoundException("Employé", command.EmployeeId);

        return Unit.Value;
    }

    public ValueTask<Unit> Handle(SetHourlyRateCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));
}
