using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Authentication.Register;

public sealed record RegisterCommand(
    string Email,
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

    public async Task<Result<AuthResponse>> HandleAsync(
        RegisterCommand command,
        CancellationToken cancellationToken = default)
    {
        // Validation simple
        if (string.IsNullOrWhiteSpace(command.Email))
        {
            return Result<AuthResponse>.Failure("L'email est requis.");
        }

        if (command.Password != command.ConfirmPassword)
        {
            return Result<AuthResponse>.Failure("Les mots de passe ne correspondent pas.");
        }

        if (string.IsNullOrWhiteSpace(command.FirstName) || string.IsNullOrWhiteSpace(command.LastName))
        {
            return Result<AuthResponse>.Failure("Le prénom et le nom sont requis.");
        }

        // Appeler le service Identity
        var result = await _identityService.RegisterAsync(
            command.Email,
            command.Password,
            command.FirstName,
            command.LastName,
            cancellationToken);

        return result;
    }
}
