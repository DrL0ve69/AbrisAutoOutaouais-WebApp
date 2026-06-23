using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Infrastructure;
using AbrisAutoOutaouais_WebApp.Infrastructure.Services.Payments;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AbrisAutoOutaouais_WebApp.UnitTest.Infrastructure.DependencyInjection;

/// <summary>
/// Garde fail-fast de sélection du fournisseur de paiement (« Payments:Provider ») dans
/// <c>AddInfrastructure</c>. C'est l'UNIQUE point d'enforcement de l'invariant budget : un
/// adaptateur payant (VoPay/Paysafe) sélectionné SANS clé doit faire échouer le DÉMARRAGE, jamais
/// encaisser par accident (L-046). Le défaut « manual » résout l'adaptateur Interac manuel ; une clé
/// présente débloque le stub correspondant.
/// </summary>
public sealed class PaymentProviderRegistrationTests
{
    /// <summary>
    /// Fausse implémentation minimale d'<see cref="IHostEnvironment"/> (environnement non-Production
    /// pour éviter le warning courriel de démarrage). Suffit aux besoins d'<c>AddInfrastructure</c>.
    /// </summary>
    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "AbrisAutoOutaouais-WebApp.UnitTest";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; }
            = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }

    /// <summary>
    /// Construit la configuration minimale exigée EAGER par <c>AddInfrastructure</c> (« Jwt:Key »,
    /// « Client:BaseUrl ») + une connexion factice (le DbContext n'est pas matérialisé ici). Le
    /// fournisseur de paiement et sa clé sont injectés par les paramètres.
    /// </summary>
    private static IConfiguration BuildConfig(string? provider, string? vopayKey = null, string? paysafeKey = null)
    {
        var values = new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "cle-de-signature-jwt-suffisamment-longue-pour-les-tests-0123456789",
            ["Client:BaseUrl"] = "https://localhost:4200",
            ["ConnectionStrings:DefaultConnection"] = "Server=(localdb)\\mssqllocaldb;Database=Test;Trusted_Connection=True;",
        };

        if (provider is not null)
            values["Payments:Provider"] = provider;
        if (vopayKey is not null)
            values["Payments:VoPay:ApiKey"] = vopayKey;
        if (paysafeKey is not null)
            values["Payments:Paysafe:ApiKey"] = paysafeKey;

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private static IPaymentService ResolvePaymentService(IServiceProvider provider)
    {
        // IPaymentService est Scoped → résolution dans un scope explicite.
        using var scope = provider.CreateScope();
        return scope.ServiceProvider.GetRequiredService<IPaymentService>();
    }

    [Fact]
    public void AddInfrastructure_VoPayProviderWithoutKey_ThrowsAtStartup()
    {
        var services = new ServiceCollection();
        var config = BuildConfig(provider: "vopay", vopayKey: "");

        // NON-VACUITÉ (L-005) : la garde fail-fast DOIT lever — sinon un adaptateur payant
        // pourrait être activé sans clé.
        var act = () => services.AddInfrastructure(config, new FakeHostEnvironment());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*VoPay*");
    }

    [Fact]
    public void AddInfrastructure_PaysafeProviderWithoutKey_ThrowsAtStartup()
    {
        var services = new ServiceCollection();
        var config = BuildConfig(provider: "paysafe", paysafeKey: "");

        var act = () => services.AddInfrastructure(config, new FakeHostEnvironment());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Paysafe*");
    }

    [Fact]
    public void AddInfrastructure_ManualProvider_ResolvesManualInteracPaymentService()
    {
        var services = new ServiceCollection();
        var config = BuildConfig(provider: "manual");

        services.AddInfrastructure(config, new FakeHostEnvironment());
        using var provider = services.BuildServiceProvider();

        ResolvePaymentService(provider).Should().BeOfType<ManualInteracPaymentService>();
    }

    [Fact]
    public void AddInfrastructure_DefaultProvider_ResolvesManualInteracPaymentService()
    {
        // Aucun « Payments:Provider » : le WebAppFactory d'intégration tombe dans ce cas (default),
        // donc la garde ne doit PAS lever et le manuel reste actif.
        var services = new ServiceCollection();
        var config = BuildConfig(provider: null);

        services.AddInfrastructure(config, new FakeHostEnvironment());
        using var provider = services.BuildServiceProvider();

        ResolvePaymentService(provider).Should().BeOfType<ManualInteracPaymentService>();
    }

    [Fact]
    public void AddInfrastructure_VoPayProviderWithKey_ResolvesVoPayPaymentService()
    {
        var services = new ServiceCollection();
        var config = BuildConfig(provider: "vopay", vopayKey: "cle-vopay-factice");

        services.AddInfrastructure(config, new FakeHostEnvironment());
        using var provider = services.BuildServiceProvider();

        ResolvePaymentService(provider).Should().BeOfType<VoPayPaymentService>();
    }

    [Fact]
    public void AddInfrastructure_PaysafeProviderWithKey_ResolvesPaysafePaymentService()
    {
        var services = new ServiceCollection();
        var config = BuildConfig(provider: "paysafe", paysafeKey: "cle-paysafe-factice");

        services.AddInfrastructure(config, new FakeHostEnvironment());
        using var provider = services.BuildServiceProvider();

        ResolvePaymentService(provider).Should().BeOfType<PaysafePaymentService>();
    }
}
