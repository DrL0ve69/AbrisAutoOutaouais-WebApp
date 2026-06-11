using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;

namespace AbrisAutoOutaouais_WebApp.Application.Auth.Register;

public sealed record RegisterCommand(
    string Email,
    string Username,
    string Password,
    string ConfirmPassword,
    string FirstName,
    string LastName) : ICommand<Result<AuthResponse>>;

public sealed class RegisterCommandHandler : ICommandHandler<RegisterCommand, Result<AuthResponse>>
{
    private readonly IIdentityService _identityService;

    public RegisterCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    // Contrat IQueryHandler/ICommandHandler — délègue à HandleAsync (appelé par le Dispatcher).
    public ValueTask<Result<AuthResponse>> Handle(RegisterCommand command, CancellationToken ct)
        => new(HandleAsync(command, ct));

    public async Task<Result<AuthResponse>> HandleAsync(
        RegisterCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Email))
            return Result<AuthResponse>.Failure("Le courriel est requis.");

        if (string.IsNullOrWhiteSpace(command.Username))
            return Result<AuthResponse>.Failure("Le nom d'utilisateur est requis.");

        if (command.Password != command.ConfirmPassword)
            return Result<AuthResponse>.Failure("Les mots de passe ne correspondent pas.");

        if (string.IsNullOrWhiteSpace(command.FirstName) || string.IsNullOrWhiteSpace(command.LastName))
            return Result<AuthResponse>.Failure("Le prénom et le nom sont requis.");

        return await _identityService.RegisterAsync(
            command.Email,
            command.Username,
            command.Password,
            command.FirstName,
            command.LastName,
            cancellationToken);
    }
}
