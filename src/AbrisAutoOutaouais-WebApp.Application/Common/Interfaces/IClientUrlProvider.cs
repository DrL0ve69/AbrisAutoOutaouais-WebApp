namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Expose l'URL de base du client Angular (clé de configuration « Client:BaseUrl »).
/// Sert à construire des liens absolus vers l'application (ex. lien de
/// réinitialisation du mot de passe envoyé par courriel).
/// </summary>
public interface IClientUrlProvider
{
    /// <summary>URL de base sans barre oblique finale (ex. http://localhost:4200).</summary>
    string BaseUrl { get; }
}
