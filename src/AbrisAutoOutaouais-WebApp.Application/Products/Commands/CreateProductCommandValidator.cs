using AbrisAutoOutaouais_WebApp.Domain.Constants;
using FluentValidation;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Commands;

public class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);
        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(1000);
        RuleFor(x => x.Price)
            .GreaterThan(0);
        RuleFor(x => x.StockQuantity)
            .GreaterThanOrEqualTo(0);
        RuleFor(x => x.CategoryId)
            .NotEmpty();

        // Dimensions optionnelles : null accepté, mais si fournie elle doit tenir
        // dans la plage métier [MinCm, MaxCm]. On NE met PAS InclusiveBetween seul
        // (il rejetterait null) — on le garde sous .When(HasValue).
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
