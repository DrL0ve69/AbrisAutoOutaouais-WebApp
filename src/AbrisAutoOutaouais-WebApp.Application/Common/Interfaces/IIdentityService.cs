namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Service d'authentification et d'autorisation.
/// </summary>
public interface IIdentityService
{
    /// <summary>
    /// Enregistre un nouvel utilisateur.
    /// </summary>
    Task<Result<AuthResponse>> RegisterAsync(
        string email,
        string password,
        string firstName,
        string lastName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Se connecte avec email/password.
    /// </summary>
    Task<Result<AuthResponse>> LoginAsync(
        string email,
        string password,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Génère un nouveau JWT token pour un utilisateur.
    /// </summary>
    Task<string> GenerateTokenAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Assigne un rôle à un utilisateur.
    /// </summary>
    Task<Result> AssignRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retire un rôle d'un utilisateur.
    /// </summary>
    Task<Result> RemoveRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default);

    /// <summary>
    /// Récupère les rôles d'un utilisateur.
    /// </summary>
    Task<IReadOnlyList<string>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Réponse d'authentification contenant le token JWT et les infos utilisateur.
/// </summary>
public sealed record AuthResponse(
    Guid UserId,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    string Token,
    IReadOnlyList<string> Roles);

/// <summary>
/// Résultat générique pour les opérations.
/// </summary>
public abstract record Result
{
    public bool IsSuccess => this is SuccessResult;
    public bool IsFailure => this is FailureResult;

    public sealed record SuccessResult : Result;
    public sealed record FailureResult(string Error) : Result;

    public static Result Success() => new SuccessResult();
    public static Result Failure(string error) => new FailureResult(error);
}

/// <summary>
/// Résultat générique avec valeur.
/// </summary>
public abstract record Result<T> where T : class?
{
    public bool IsSuccess => this is SuccessResult;
    public bool IsFailure => this is FailureResult;
    public T? Value => (this as SuccessResult)?.Value;
    public string? Error => (this as FailureResult)?.Error;

    public sealed record SuccessResult(T? Value) : Result<T>;
    public sealed record FailureResult(string Error) : Result<T>;

    public static Result<T> Success(T? value) => new SuccessResult(value);
    public static Result<T> Failure(string error) => new FailureResult(error);
}
