using AbrisAutoOutaouais_WebApp.Application.Payments.Common;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services.Payments;
using Microsoft.Extensions.Options;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Services;

/// <summary>
/// Adaptateur de paiement par défaut (virement Interac manuel) : instructions correctes au format
/// canonique, jamais d'exception (aucun réseau), statut toujours Pending (réconciliation admin).
/// </summary>
public sealed class ManualInteracPaymentServiceTests
{
    private static ManualInteracPaymentService CreateSut(string recipient = "paiements@abristempo-local.example")
    {
        var options = Options.Create(new PaymentsOptions
        {
            Provider = "manual",
            Manual = new ManualPaymentOptions { RecipientEmail = recipient },
        });
        return new ManualInteracPaymentService(options);
    }

    [Fact]
    public async Task InitiateAsync_ReturnsCanonicalInstructions_WithRecipientReferenceAndAmount()
    {
        var sut = CreateSut("marchand@exemple.ca");

        var result = await sut.InitiateAsync(
            "ABR-REF000000001", 799.00m, "client@test.com", TestContext.Current.CancellationToken);

        result.Reference.Should().Be("ABR-REF000000001");
        result.RecipientEmail.Should().Be("marchand@exemple.ca");
        result.Amount.Should().Be(799.00m);
        result.Instructions.Should().NotBeNullOrWhiteSpace();
        // Les instructions exposent la référence et le courriel marchand (saisie manuelle du virement).
        result.Instructions.Should().Contain("ABR-REF000000001");
        result.Instructions.Should().Contain("marchand@exemple.ca");
        result.Instructions.Should().Contain("Interac");
    }

    [Fact]
    public async Task InitiateAsync_NeverThrows_EvenWithZeroAmount()
    {
        var sut = CreateSut();

        var act = async () => await sut.InitiateAsync(
            "ABR-REF000000002", 0m, "client@test.com", TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task GetStatusAsync_ReturnsPending_ConfirmationIsAdminReconciliation()
    {
        var sut = CreateSut();

        var status = await sut.GetStatusAsync("ABR-REF000000003", TestContext.Current.CancellationToken);

        status.Should().Be(PaymentStatus.Pending);
    }
}
