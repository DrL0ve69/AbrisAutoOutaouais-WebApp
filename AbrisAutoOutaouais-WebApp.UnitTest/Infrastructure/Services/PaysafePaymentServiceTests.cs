using AbrisAutoOutaouais_WebApp.Application.Payments.Common;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services.Payments;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.Services;

/// <summary>
/// Stub keyless Paysafe : adaptateur d'extensibilité NON activé. Le contrat de résilience du port
/// doit tenir (ne lève jamais, aucun réseau), les instructions doivent annoncer explicitement qu'il
/// s'agit d'un stub, et le statut reste Pending.
/// </summary>
public sealed class PaysafePaymentServiceTests
{
    // Stub keyless : aucune option n'est nécessaire (la garde de clé vit dans DependencyInjection).
    private static PaysafePaymentService CreateSut() => new();

    [Fact]
    public async Task InitiateAsync_NeverThrows_AndReturnsStubInstructions()
    {
        var sut = CreateSut();

        var result = await sut.InitiateAsync(
            "ABR-REF000000001", 799.00m, "client@test.com", TestContext.Current.CancellationToken);

        result.Reference.Should().Be("ABR-REF000000001");
        result.Amount.Should().Be(799.00m);
        result.Instructions.Should().NotBeNullOrWhiteSpace();
        // Placeholder MANIFESTE : les instructions disent que l'adaptateur est un stub non activé.
        result.Instructions.Should().Contain("STUB");
        result.Instructions.Should().Contain("Paysafe");
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
    public async Task GetStatusAsync_ReturnsPending()
    {
        var sut = CreateSut();

        var status = await sut.GetStatusAsync("ABR-REF000000003", TestContext.Current.CancellationToken);

        status.Should().Be(PaymentStatus.Pending);
    }
}
