using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Auth.Login;

public sealed record LoginCommand(
    string Email,
    string Password) : ICommand<Result<AuthResponse>>;

public sealed class LoginCommandHandler : ICommandHandler<LoginCommand, Result<AuthResponse>>
{
    private readonly IIdentityService _identityService;

    public LoginCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    public async ValueTask<Result<AuthResponse>> Handle(LoginCommand command, CancellationToken ct)
    {
        // Validation simple
        if (string.IsNullOrWhiteSpace(command.Email) || string.IsNullOrWhiteSpace(command.Password))
        {
            return Result<AuthResponse>.Failure("L'email et le mot de passe sont requis.");
        }

        // Appeler le service Identity
        var result = await _identityService.LoginAsync(
            command.Email,
            command.Password,
            ct);

        return result;
    }

    public async Task<Result<AuthResponse>> HandleAsync(
        LoginCommand command,
        CancellationToken cancellationToken = default)
    {
        // Validation simple
        if (string.IsNullOrWhiteSpace(command.Email) || string.IsNullOrWhiteSpace(command.Password))
        {
            return Result<AuthResponse>.Failure("L'email et le mot de passe sont requis.");
        }

        // Appeler le service Identity
        var result = await _identityService.LoginAsync(
            command.Email,
            command.Password,
            cancellationToken);

        return result;
    }
}
