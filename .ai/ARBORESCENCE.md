# ARBORESCENCE.md — AbrisTempo Local

Arborescence complète du projet avec au moins un exemple de fichier par dossier.
Les fichiers marqués `★` ont un exemple de code dans `CODE_EXAMPLES.md`.

---

## Backend (`src/`)

```
AbrisTempo.sln
Directory.Packages.props              ← Central Package Management
.editorconfig
.gitignore

src/
├── Domain/
│   ├── Domain.csproj
│   ├── Constants/
│   │   └── Roles.cs                  ★ rôles métier (Member/Admin/Staff)
│   ├── Entities/
│   │   ├── Product.cs                ★ entité produit avec factory + invariants
│   │   ├── ProductCategory.cs
│   │   ├── Order.cs                  ★ agrégat commande
│   │   ├── OrderLine.cs
│   │   ├── RentalContract.cs         ★ contrat de location
│   │   ├── BookingSlot.cs            ★ créneau d'installation
│   │   
│   ├── ValueObjects/
│   │   ├── Address.cs                ★ valeur objet adresse (owned entity)
│   │   ├── Money.cs
│   │   └── PhoneNumber.cs
│   ├── Enums/
│   │   ├── OrderStatus.cs
│   │   ├── RentalStatus.cs
│   │   ├── BookingStatus.cs
│   │   ├── DeliveryType.cs
│   │   └── ProductCategory.cs
│   ├── Events/
│   │   ├── OrderPlacedEvent.cs
│   │   └── BookingConfirmedEvent.cs
│   ├── Exceptions/
│   │   ├── NotFoundException.cs      ★
│   │   ├── ForbiddenException.cs
│   │   ├── ConflictException.cs
│   │   └── BusinessRuleException.cs
│   └── Interfaces/
│       ├── ISoftDeletable.cs         ★ interface soft delete
│       └── IAuditableEntity.cs
│
├── Application/
│   ├── Application.csproj
│   ├── Common/
│   │   ├── Interfaces/
│   │   │   ├── IApplicationDbContext.cs  ★
│   │   │   ├── ICurrentUserService.cs
│   │   │   ├── IDateTimeProvider.cs
│   │   │   ├── IEmailService.cs
│   │   │   └── IFileStorageService.cs
│   │   ├── Mediator/
│   │   │   ├── ICommand.cs           ★ interfaces Mediator maison
│   │   │   ├── IQuery.cs
│   │   │   ├── ICommandHandler.cs
│   │   │   ├── IQueryHandler.cs
│   │   │   └── Dispatcher.cs         ★ implémentation du dispatcher
│   │   ├── Behaviors/
│   │   │   ├── ValidationBehavior.cs ★ pipeline FluentValidation
│   │   │   └── LoggingBehavior.cs
│   │   └── Models/
│   │       ├── Result.cs             ★ Result<T> pattern
│   │       └── PaginatedList.cs
│   │
│   ├── Products/
│   │   ├── Commands/
│   │   │   ├── CreateProduct/
│   │   │   │   ├── CreateProductCommand.cs      ★
│   │   │   │   ├── CreateProductCommandHandler.cs ★
│   │   │   │   └── CreateProductCommandValidator.cs ★
│   │   │   ├── UpdateProduct/
│   │   │   │   ├── UpdateProductCommand.cs
│   │   │   │   ├── UpdateProductCommandHandler.cs
│   │   │   │   └── UpdateProductCommandValidator.cs
│   │   │   └── DeleteProduct/
│   │   │       ├── DeleteProductCommand.cs
│   │   │       └── DeleteProductCommandHandler.cs
│   │   ├── Queries/
│   │   │   ├── GetProductBySlug/
│   │   │   │   ├── GetProductBySlugQuery.cs     ★
│   │   │   │   ├── GetProductBySlugQueryHandler.cs ★
│   │   │   │   └── ProductDto.cs                ★
│   │   │   └── GetProducts/
│   │   │       ├── GetProductsQuery.cs
│   │   │       ├── GetProductsQueryHandler.cs
│   │   │       └── ProductSummaryDto.cs
│   │   └── DTOs/
│   │       └── CreateProductRequest.cs
│   │
│   ├── Orders/
│   │   ├── Commands/
│   │   │   ├── PlaceOrder/
│   │   │   │   ├── PlaceOrderCommand.cs         ★
│   │   │   │   ├── PlaceOrderCommandHandler.cs  ★
│   │   │   │   └── PlaceOrderCommandValidator.cs
│   │   │   └── CancelOrder/
│   │   │       ├── CancelOrderCommand.cs
│   │   │       └── CancelOrderCommandHandler.cs
│   │   └── Queries/
│   │       ├── GetMyOrders/
│   │       │   ├── GetMyOrdersQuery.cs
│   │       │   ├── GetMyOrdersQueryHandler.cs
│   │       │   └── OrderSummaryDto.cs
│   │       └── GetOrderById/
│   │           ├── GetOrderByIdQuery.cs
│   │           ├── GetOrderByIdQueryHandler.cs
│   │           └── OrderDetailDto.cs            ★
│   │
│   ├── Rentals/
│   │   ├── Commands/
│   │   │   ├── CreateRentalContract/
│   │   │   │   ├── CreateRentalContractCommand.cs  ★
│   │   │   │   ├── CreateRentalContractCommandHandler.cs
│   │   │   │   └── CreateRentalContractCommandValidator.cs
│   │   │   └── CancelRental/
│   │   │       └── ...
│   │   └── Queries/
│   │       └── GetMyRentals/
│   │           └── ...
│   │
│   └── Bookings/
│       ├── Commands/
│       │   ├── CreateBooking/
│       │   │   ├── CreateBookingCommand.cs      ★
│       │   │   ├── CreateBookingCommandHandler.cs ★
│       │   │   └── CreateBookingCommandValidator.cs
│       │   └── ConfirmBooking/
│       │       └── ...
│       └── Queries/
│           ├── GetAvailableSlots/
│           │   ├── GetAvailableSlotsQuery.cs
│           │   └── GetAvailableSlotsQueryHandler.cs
│           └── GetMyBookings/
│               └── ...
│
├── Infrastructure/
│   ├── Infrastructure.csproj
│   ├── DependencyInjection.cs        ★ registration complète
│   ├── Identity/
│   │   ├── ApplicationUser.cs        ★
│   │   ├── ApplicationRole.cs
│   │   ├── AppIdentityDbContext.cs   ★
│   │   ├── DesignTimeIdentityDbContextFactory.cs
│   │   ├── TokenService.cs           ★
│   │   └── Migrations/               ← générés par EF
│   ├── Persistence/
│   │   ├── ApplicationDbContext.cs   ★
│   │   ├── DesignTimeApplicationDbContextFactory.cs
│   │   ├── Interceptors/
│   │   │   ├── SoftDeleteInterceptor.cs  ★
│   │   │   └── AuditInterceptor.cs
│   │   ├── Configurations/
│   │   │   ├── ProductConfiguration.cs  ★
│   │   │   ├── OrderConfiguration.cs
│   │   │   ├── OrderLineConfiguration.cs
│   │   │   ├── RentalContractConfiguration.cs
│   │   │   ├── BookingSlotConfiguration.cs
│   │   │   └── CustomerConfiguration.cs
│   │   └── Migrations/               ← générés par EF
│   └── Services/
│       ├── CurrentUserService.cs     ★
│       ├── DateTimeProvider.cs
│       ├── EmailService.cs
│       └── LocalFileStorageService.cs
│
└── Api/
    ├── Api.csproj
    ├── Program.cs                    ★ composition root complet
    ├── GlobalExceptionHandler.cs     ★
    ├── Controllers/
    │   ├── ProductsController.cs     ★
    │   ├── OrdersController.cs
    │   ├── RentalsController.cs
    │   ├── BookingsController.cs
    │   └── AuthController.cs         ★
    ├── Constants/
    │   └── ApiRoutes.cs
    └── appsettings.json
        appsettings.Development.json

tests/
├── Unit/
│   ├── Unit.csproj
│   ├── Domain/
│   │   ├── ProductTests.cs           ★
│   │   └── OrderTests.cs
│   └── Application/
│       ├── CreateProductCommandHandlerTests.cs ★
│       └── PlaceOrderCommandHandlerTests.cs
└── Integration/
    ├── Integration.csproj
    ├── WebAppFactory.cs
    └── Products/
        └── ProductsEndpointTests.cs
```

---

## Frontend (`client/`)

```
client/
├── package.json
├── angular.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
│
└── src/
    ├── main.ts
    ├── main.server.ts
    ├── styles.scss
    │
    ├── environments/
    │   ├── environment.ts            ★
    │   └── environment.prod.ts
    │
    ├── i18n/
    │   ├── messages.fr.xlf
    │   └── messages.en.xlf
    │
    ├── assets/
    │   ├── images/
    │   └── icons/
    │
    └── app/
        ├── app.ts                    ★ composant racine
        ├── app.html
        ├── app.scss
        ├── app.routes.ts             ★ routes lazy-loaded
        ├── app.config.ts             ★ providers + interceptors
        │
        ├── core/
        │   ├── services/
        │   │   ├── auth.service.ts   ★
        │   │   ├── cart.service.ts   ★
        │   │   └── toast.service.ts
        │   ├── interceptors/
        │   │   ├── auth.interceptor.ts      ★
        │   │   └── error.interceptor.ts
        │   ├── guards/
        │   │   ├── auth.guard.ts     ★
        │   │   ├── admin.guard.ts
        │   │   └── public.guard.ts
        │   └── models/
        │       ├── auth.model.ts
        │       ├── product.model.ts  ★
        │       ├── order.model.ts
        │       ├── rental.model.ts
        │       └── booking.model.ts
        │
        ├── shared/
        │   ├── styles/
        │   │   ├── _tokens.scss      ★ design tokens (couleurs, spacing, typo)
        │   │   ├── _breakpoints.scss
        │   │   └── _mixins.scss
        │   ├── components/
        │   │   ├── button/
        │   │   │   ├── button.ts     ★
        │   │   │   ├── button.html
        │   │   │   └── button.scss
        │   │   ├── product-card/
        │   │   │   ├── product-card.ts  ★
        │   │   │   ├── product-card.html
        │   │   │   └── product-card.scss
        │   │   └── booking-calendar/
        │   │       ├── booking-calendar.ts ★
        │   │       ├── booking-calendar.html
        │   │       └── booking-calendar.scss
        │   ├── pipes/
        │   │   ├── currency-cad.pipe.ts
        │   │   └── booking-status.pipe.ts
        │   └── layout/
        │       ├── navbar/
        │       │   ├── navbar.ts     ★
        │       │   ├── navbar.html
        │       │   └── navbar.scss
        │       └── footer/
        │           ├── footer.ts
        │           └── footer.html
        │
        └── features/
            ├── home/
            │   ├── home.routes.ts
            │   └── home/
            │       ├── home.ts       ★
            │       ├── home.html
            │       └── home.scss
            │
            ├── shop/
            │   ├── shop.routes.ts    ★
            │   ├── catalog/
            │   │   ├── catalog.ts
            │   │   ├── catalog.html
            │   │   └── catalog.scss
            │   ├── product-detail/
            │   │   ├── product-detail.ts  ★
            │   │   ├── product-detail.html
            │   │   └── product-detail.scss
            │   └── cart/
            │       ├── cart.ts
            │       ├── cart.html
            │       └── cart.scss
            │
            ├── checkout/
            │   ├── checkout.routes.ts
            │   ├── checkout/
            │   │   ├── checkout.ts   ★
            │   │   ├── checkout.html
            │   │   └── checkout.scss
            │   └── order-confirmation/
            │       └── ...
            │
            ├── rental/
            │   ├── rental.routes.ts
            │   ├── rental-catalog/
            │   │   └── ...
            │   └── rental-contract/
            │       └── ...
            │
            ├── booking/
            │   ├── booking.routes.ts
            │   ├── booking-form/
            │   │   ├── booking-form.ts  ★
            │   │   ├── booking-form.html
            │   │   └── booking-form.scss
            │   └── my-bookings/
            │       └── ...
            │
            ├── auth/
            │   ├── auth.routes.ts
            │   ├── login/
            │   │   ├── login.ts      ★
            │   │   ├── login.html
            │   │   └── login.scss
            │   └── register/
            │       └── ...
            │
            ├── account/
            │   ├── account.routes.ts
            │   ├── my-orders/
            │   │   └── ...
            │   ├── my-rentals/
            │   │   └── ...
            │   └── profile/
            │       └── ...
            │
            └── admin/
                ├── admin.routes.ts
                ├── dashboard/
                │   └── ...
                ├── products-manage/
                │   └── ...
                ├── orders-manage/
                │   └── ...
                └── bookings-manage/
                    └── ...
```

---

## GitHub Actions (`.github/workflows/`)

```
.github/
└── workflows/
    ├── frontend.yml    ← CI sur PR : vitest + lint + build prod
    └── backend.yml     ← CI/CD sur push main : build + test + deploy Azure
```
