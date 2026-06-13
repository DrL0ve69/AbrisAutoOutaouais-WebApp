using AbrisAutoOutaouais_WebApp.Domain.Constants;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

/// <summary>
/// Validation de la mise à jour d'un produit. Calque exact de
/// <see cref="CreateProductCommandValidator"/> (Name/Description/Price/Stock/CategoryId)
/// plus les 3 dimensions optionnelles. Existe car l'Update n'était pas validé du tout
/// auparavant — un trou silencieux que ce validator referme.
/// </summary>
public sealed class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);
        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(1000);
        RuleFor(x => x.Price)
            .GreaterThan(0);
        RuleFor(x => x.Stock)
            .GreaterThanOrEqualTo(0);
        RuleFor(x => x.CategoryId)
            .NotEmpty();

        // Dimensions optionnelles : null accepté, mais si fournie elle doit tenir
        // dans la plage métier [MinCm, MaxCm]. InclusiveBetween sous .When(HasValue)
        // pour ne pas rejeter null.
        RuleFor(x => x.WidthCm)
            .InclusiveBetween(ProductDimensions.MinCm, ProductDimensions.MaxCm)
            .When(x => x.WidthCm.HasValue);
        RuleFor(x => x.LengthCm)
            .InclusiveBetween(ProductDimensions.MinCm, ProductDimensions.MaxCm)
            .When(x => x.LengthCm.HasValue);
        RuleFor(x => x.HeightCm)
            .InclusiveBetween(ProductDimensions.MinCm, ProductDimensions.MaxCm)
            .When(x => x.HeightCm.HasValue);
    }
}
