using AbrisAutoOutaouais_WebApp.Application.Auth.DTOs;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Payments.Common;
using AbrisAutoOutaouais_WebApp.Application.Rentals.Commands.CreateRentalContract;
using AbrisAutoOutaouais_WebApp.Infrastructure.Persistence;
using AbrisAutoOutaouais_WebApp.UnitTest.Application.Helpers;
using NSubstitute;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Application.Handlers.Rentals;

/// <summary>
/// Création d'un contrat de location sur un MODÈLE paramétrique louable (rework). Couvre la
/// résolution du CustomerId (connecté → son Id ; visiteur avec contact → compte express ; sinon
/// règle métier), le 404 sur slug inconnu, le 422 sur modèle non louable, et le paiement (virement
/// Interac, EPIC 7.2 : réf attachée + instructions retournées + contrat PendingPayment).
/// </summary>
public sealed class CreateRentalContractCommandHandlerTests : IDisposable
{
    private readonly ApplicationDbContext _db = TestDbContextFactory.Create();
    private readonly ICurrentUserService _currentUser = Substitute.For<ICurrentUserService>();
    private readonly IExpressAccountService _express = Substitute.For<IExpressAccountService>();
    private readonly IPaymentService _payment = Substitute.For<IPaymentService>();
    private readonly IPaymentReferenceGenerator _paymentRefs = Substitute.For<IPaymentReferenceGenerator>();

    public CreateRentalContractCommandHandlerTests()
    {
        // Le double imite le fournisseur PAR DÉFAUT (virement Interac manuel) : une référence
        // non vide + des instructions e-Transfer au format canonique (L-011).
        _paymentRefs.Generate().Returns(_ => $"ABR-{Guid.NewGuid():N}"[..16]);
        _payment.InitiateAsync(Arg.Any<string>(), Arg.Any<decimal>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(call => new PaymentInstructionsResult(
                Reference: call.ArgAt<string>(0),
                RecipientEmail: "paiements@abristempo-local.example",
                Amount: call.ArgAt<decimal>(1),
                Instructions: "Faites un virement Interac."));
    }

    private CreateRentalContractCommandHandler CreateHandler()
        => new(_db, _currentUser, _express, _payment, _paymentRefs);

    /// <summary>Sème un modèle LOUABLE (slug « abri-loc ») + une catégorie, et retourne son slug.</summary>
    private async Task<string> SeedRentableModelAsync(int? monthlyRentalCents = 4900)
    {
        var cat = ProductCategory.Create("Abris", "abris");
        var model = ShelterModelTestData.CreateWithGrid(
            "abri-loc", "Abri simple — Abris Tempo", cat.Id,
            lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 366,
            basePrice: 349.00m, pricePerArchCents: 15000,
            widthsCm: [335], clearHeightsCm: [198],
            monthlyRentalCents: monthlyRentalCents);
        _db.ProductCategories.Add(cat);
        _db.ShelterModels.Add(model);
        await _db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return model.Slug;
    }

    private static CreateRentalContractCommand Command(string slug, GuestContact? guest = null) => new(
        Slug: slug,
        LengthCm: 122,
        ClearHeightCm: 198,
        StartDate: new DateOnly(2026, 7, 1),
        EndDate: new DateOnly(2026, 10, 1),
        Address: new AddressDto("123", "rue des Érables", null, "Gatineau", "QC", "J8X 1A1", "Canada"),
        GuestContact: guest);

    [Fact]
    public async Task Handle_AuthenticatedUser_UsesUserIdAndSkipsExpress()
    {
        var slug = await SeedRentableModelAsync();
        var userId = Guid.NewGuid();
        _currentUser.UserId.Returns(userId);
        _currentUser.Email.Returns("client@test.com");

        var id = (await CreateHandler().HandleAsync(
            Command(slug), TestContext.Current.CancellationToken)).RentalId;

        var contract = await _db.RentalContracts.FindAsync([id], TestContext.Current.CancellationToken);
        contract!.CustomerId.Should().Be(userId);
        contract.ShelterModelSlug.Should().Be(slug);
        contract.MonthlyRate.Should().Be(49.00m);
        await _express.DidNotReceiveWithAnyArgs()
            .FindOrCreateByEmailAsync(Arg.Any<GuestContact>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_GuestWithContact_ResolvesCustomerViaExpressService()
    {
        var slug = await SeedRentableModelAsync();
        var expressId = Guid.NewGuid();
        _currentUser.UserId.Returns((Guid?)null);
        _currentUser.Email.Returns((string?)null);
        var contact = new GuestContact("Jean", "Tremblay", "jean@test.com", null);
        _express.FindOrCreateByEmailAsync(contact, Arg.Any<CancellationToken>()).Returns(expressId);

        var id = (await CreateHandler().HandleAsync(
            Command(slug, contact), TestContext.Current.CancellationToken)).RentalId;

        var contract = await _db.RentalContracts.FindAsync([id], TestContext.Current.CancellationToken);
        contract!.CustomerId.Should().Be(expressId);
    }

    [Fact]
    public async Task Handle_NeitherAuthenticatedNorContact_ThrowsBusinessRule()
    {
        var slug = await SeedRentableModelAsync();
        _currentUser.UserId.Returns((Guid?)null);

        var act = async () => await CreateHandler().HandleAsync(
            Command(slug), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_UnknownSlug_ThrowsNotFound()
    {
        await SeedRentableModelAsync();
        _currentUser.UserId.Returns(Guid.NewGuid());

        var act = async () => await CreateHandler().HandleAsync(
            Command("slug-inexistant"), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_NonRentableModel_ThrowsBusinessRule()
    {
        var slug = await SeedRentableModelAsync(monthlyRentalCents: null); // modèle non louable
        _currentUser.UserId.Returns(Guid.NewGuid());

        var act = async () => await CreateHandler().HandleAsync(
            Command(slug), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    // ── Paiement (virement Interac) — EPIC 7.2 ──────────────────────────────────

    [Fact]
    public async Task Handle_AttachesPaymentReference_InitiatesPayment_AndKeepsContractPendingPayment()
    {
        var slug = await SeedRentableModelAsync();   // tarif mensuel 49 $
        _currentUser.UserId.Returns(Guid.NewGuid());
        _currentUser.Email.Returns("client@test.com");

        var result = await CreateHandler().HandleAsync(
            Command(slug), TestContext.Current.CancellationToken);

        // La réponse porte les instructions de paiement au format canonique (référence non vide).
        result.Payment.Reference.Should().NotBeNullOrWhiteSpace();
        result.Payment.RecipientEmail.Should().Be("paiements@abristempo-local.example");
        result.Payment.Amount.Should().Be(49.00m);   // tarif mensuel du modèle louable

        // La référence est attachée à l'agrégat ET le contrat reste en attente de paiement.
        var contract = await _db.RentalContracts.FindAsync(
            [result.RentalId], TestContext.Current.CancellationToken);
        contract!.Status.Should().Be(RentalStatus.PendingPayment);
        contract.Payment.Should().NotBeNull();
        contract.Payment!.Reference.Should().Be(result.Payment.Reference);
        contract.Payment.ConfirmedAt.Should().BeNull();

        // Le port de paiement a bien été initié avec la référence générée et le tarif mensuel.
        await _payment.Received(1).InitiateAsync(
            contract.Payment.Reference, 49.00m, "client@test.com", Arg.Any<CancellationToken>());
    }

    public void Dispose() => _db.Dispose();
}
