using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Domain.Constants;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Identity;

/// <summary>
/// Tests du compte express (parcours invité, Épic F). On substitue <see cref="UserManager{AppUser}"/>
/// via un <see cref="IUserStore{AppUser}"/> simulé (NSubstitute) pour vérifier la logique de
/// trouve-ou-crée sans base de données : réutilisation d'un compte existant (réel ou express),
/// création passwordless + rôle Customer, et idempotence sur collision de courriel concurrente.
/// </summary>
public sealed class ExpressAccountServiceTests
{
    private readonly IUserStore<AppUser> _store = Substitute.For<IUserStore<AppUser>>();
    private readonly UserManager<AppUser> _userManager;

    private static readonly GuestContact Contact =
        new("Jean", "Tremblay", "jean.tremblay@test.com", "819-555-0199");

    public ExpressAccountServiceTests()
    {
        // UserManager a un constructeur lourd : seuls le store, le hasher et les validateurs sont
        // sollicités ici. On passe des substituts/null pour le reste (suffisant pour ces tests).
        _userManager = Substitute.For<UserManager<AppUser>>(
            _store, null, null, null, null, null, null, null, null);
    }

    private ExpressAccountService CreateService() => new(_userManager);

    [Fact]
    public async Task FindOrCreate_WithExistingRealAccount_ReturnsItsIdAndCreatesNothing()
    {
        var existing = new AppUser { Id = Guid.NewGuid(), Email = Contact.Email, IsExpress = false };
        _userManager.FindByEmailAsync(Contact.Email).Returns(existing);

        var id = await CreateService().FindOrCreateByEmailAsync(
            Contact, TestContext.Current.CancellationToken);

        id.Should().Be(existing.Id);
        await _userManager.DidNotReceiveWithAnyArgs().CreateAsync(default!);
        await _userManager.DidNotReceiveWithAnyArgs().AddToRoleAsync(default!, default!);
    }

    [Fact]
    public async Task FindOrCreate_WithExistingExpressAccount_ReusesItWithoutCreating()
    {
        var existing = new AppUser { Id = Guid.NewGuid(), Email = Contact.Email, IsExpress = true };
        _userManager.FindByEmailAsync(Contact.Email).Returns(existing);

        var id = await CreateService().FindOrCreateByEmailAsync(
            Contact, TestContext.Current.CancellationToken);

        id.Should().Be(existing.Id);
        await _userManager.DidNotReceiveWithAnyArgs().CreateAsync(default!);
    }

    [Fact]
    public async Task FindOrCreate_WhenUnknown_CreatesPasswordlessExpressUserWithCustomerRole()
    {
        AppUser? created = null;
        _userManager.FindByEmailAsync(Contact.Email).Returns((AppUser?)null);
        _userManager.CreateAsync(Arg.Do<AppUser>(u => created = u)).Returns(IdentityResult.Success);
        _userManager.AddToRoleAsync(Arg.Any<AppUser>(), Roles.Customer).Returns(IdentityResult.Success);

        var id = await CreateService().FindOrCreateByEmailAsync(
            Contact, TestContext.Current.CancellationToken);

        created.Should().NotBeNull();
        created!.IsExpress.Should().BeTrue();
        created.Email.Should().Be(Contact.Email);
        created.UserName.Should().Be(Contact.Email);
        created.FirstName.Should().Be(Contact.FirstName);
        created.LastName.Should().Be(Contact.LastName);
        created.PhoneNumber.Should().Be(Contact.Phone);
        created.EmailConfirmed.Should().BeFalse();
        id.Should().Be(created.Id);

        // Création SANS mot de passe (surcharge CreateAsync(user) — jamais CreateAsync(user, password)).
        await _userManager.Received(1).CreateAsync(Arg.Any<AppUser>());
        await _userManager.DidNotReceiveWithAnyArgs().CreateAsync(default!, default!);
        await _userManager.Received(1).AddToRoleAsync(Arg.Any<AppUser>(), Roles.Customer);
    }

    [Fact]
    public async Task FindOrCreate_WhenDuplicateRace_RefetchesAndReturnsWinnerId()
    {
        var winner = new AppUser { Id = Guid.NewGuid(), Email = Contact.Email, IsExpress = true };

        // 1er appel : introuvable → on tente de créer ; 2e appel (après collision) : le gagnant.
        _userManager.FindByEmailAsync(Contact.Email).Returns((AppUser?)null, winner);

        var duplicate = new IdentityErrorDescriber().DuplicateEmail(Contact.Email);
        _userManager.CreateAsync(Arg.Any<AppUser>())
            .Returns(IdentityResult.Failed(duplicate));

        var id = await CreateService().FindOrCreateByEmailAsync(
            Contact, TestContext.Current.CancellationToken);

        id.Should().Be(winner.Id);
        await _userManager.Received(2).FindByEmailAsync(Contact.Email);
    }

    [Fact]
    public async Task FindOrCreate_WhenCreateFailsForOtherReason_ThrowsBusinessRule()
    {
        _userManager.FindByEmailAsync(Contact.Email).Returns((AppUser?)null);
        _userManager.CreateAsync(Arg.Any<AppUser>())
            .Returns(IdentityResult.Failed(new IdentityError { Code = "Whatever", Description = "Boom." }));

        var act = async () => await CreateService().FindOrCreateByEmailAsync(
            Contact, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }
}
