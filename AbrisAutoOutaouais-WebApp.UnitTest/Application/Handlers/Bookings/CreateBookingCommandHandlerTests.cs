using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Bookings.Commands.CreateBooking;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Bookings;

/// <summary>
/// Résolution du CustomerId dans CreateBooking : connecté → son Id (express jamais appelé) ;
/// visiteur avec contact → Id du compte express ; sinon règle métier (Épic F).
/// </summary>
public sealed class CreateBookingCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ICurrentUserService _currentUser = Substitute.For<ICurrentUserService>();
    private readonly IExpressAccountService _express = Substitute.For<IExpressAccountService>();

    private CreateBookingCommandHandler CreateHandler()
        => new(_db, _currentUser, _express);

    // Créneau futur aligné (10 h UTC un jour ouvré dans ~40 jours), pour passer les invariants de l'agrégat.
    private static DateTime FutureSlot()
    {
        var day = DateTime.UtcNow.Date.AddDays(40);
        while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            day = day.AddDays(1);
        return new DateTime(day.Year, day.Month, day.Day, 10, 0, 0, DateTimeKind.Utc);
    }

    private static CreateBookingCommand Command(GuestContact? guest = null) => new(
        SlotStart: FutureSlot(),
        Type: BookingType.Installation,
        Address: new AddressDto("123", "rue des Érables", null, "Gatineau", "QC", "J8X 1A1", "Canada"),
        Notes: null,
        Brand: null,
        Model: null,
        GuestContact: guest);

    [Fact]
    public async Task Handle_AuthenticatedUser_UsesUserIdAndSkipsExpress()
    {
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);

        var id = await CreateHandler().HandleAsync(
            Command(), TestContext.Current.CancellationToken);

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.CustomerId.Should().Be(userId);
        await _express.DidNotReceiveWithAnyArgs()
            .FindOrCreateByEmailAsync(Arg.Any<GuestContact>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_GuestWithContact_ResolvesCustomerViaExpressService()
    {
        var expressId = Guid.NewGuid();
        _currentUser.UserId.Returns((Guid?)null);
        var contact = new GuestContact("Jean", "Tremblay", "jean@test.com", null);
        _express.FindOrCreateByEmailAsync(contact, Arg.Any<CancellationToken>()).Returns(expressId);

        var id = await CreateHandler().HandleAsync(
            Command(contact), TestContext.Current.CancellationToken);

        var booking = await _db.BookingSlots.FindAsync([id], TestContext.Current.CancellationToken);
        booking!.CustomerId.Should().Be(expressId);
    }

    [Fact]
    public async Task Handle_NeitherAuthenticatedNorContact_ThrowsBusinessRule()
    {
        _currentUser.UserId.Returns((Guid?)null);

        var act = async () => await CreateHandler().HandleAsync(
            Command(), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    public void Dispose() => _db.Dispose();
}
