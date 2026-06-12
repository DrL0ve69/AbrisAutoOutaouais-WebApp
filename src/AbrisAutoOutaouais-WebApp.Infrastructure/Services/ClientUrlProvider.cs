using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services;

/// <summary>
/// Lit l'URL de base du client Angular depuis la configuration (« Client:BaseUrl »).
/// Échoue au démarrage si la clé est absente — même idiome que « Jwt:Key ».
/// </summary>
internal sealed class ClientUrlProvider : IClientUrlProvider
{
    public ClientUrlProvider(IConfiguration config)
        => BaseUrl = (config["Client:BaseUrl"]
                ?? throw new InvalidOperationException("Client:BaseUrl requis."))
            .TrimEnd('/');

    public string BaseUrl { get; }
}
