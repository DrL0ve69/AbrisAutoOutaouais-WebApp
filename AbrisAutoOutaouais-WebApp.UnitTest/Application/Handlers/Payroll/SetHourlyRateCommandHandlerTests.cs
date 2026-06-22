using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Payroll.Commands.SetHourlyRate;
using System;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Payroll;

/// <summary>
/// Édition du taux horaire (EPIC 8) : délègue au <see cref="IIdentityService.SetHourlyRateAsync"/>
/// (frontière — pas d'accès AppUser) et remonte un 404 (NotFoundException) si l'employé est
/// introuvable ou non-Staff.
/// </summary>
public sealed class SetHourlyRateCommandHandlerTests
{
    private readonly IIdentityService _identity = Substitute.For<IIdentityService>();
    private static readonly Guid Employee = Guid.NewGuid();

    private SetHourlyRateCommandHandler CreateHandler() => new(_identity);

    [Fact]
    public async Task Handle_Success_DelegatesToIdentity()
    {
        _identity.SetHourlyRateAsync(Employee, 25m, Arg.Any<CancellationToken>())
            .Returns(Result.Success());

        await CreateHandler().HandleAsync(
            new SetHourlyRateCommand(Employee, 25m), TestContext.Current.CancellationToken);

        await _identity.Received(1).SetHourlyRateAsync(Employee, 25m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_NullRate_ClearsRate()
    {
        _identity.SetHourlyRateAsync(Employee, null, Arg.Any<CancellationToken>())
            .Returns(Result.Success());

        await CreateHandler().HandleAsync(
            new SetHourlyRateCommand(Employee, null), TestContext.Current.CancellationToken);

        await _identity.Received(1).SetHourlyRateAsync(Employee, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_IdentityFailure_ThrowsNotFound()
    {
        _identity.SetHourlyRateAsync(Employee, 25m, Arg.Any<CancellationToken>())
            .Returns(Result.Failure("Employé introuvable."));

        var act = () => CreateHandler().HandleAsync(
            new SetHourlyRateCommand(Employee, 25m), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<NotFoundException>();
    }
}
