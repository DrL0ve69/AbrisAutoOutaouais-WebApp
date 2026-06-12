using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Auth.ForgotPassword;

public sealed class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Le courriel est requis.")
            .EmailAddress().WithMessage("Format de courriel invalide.");
    }
}
