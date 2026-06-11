# ARBORESCENCE.md — AbrisTempo Local

Arborescence réelle du projet avec au moins un exemple de fichier par dossier.
Les fichiers marqués `★` sont des points d'entrée notables.

> Les sections « Cible / à venir (non encore implémenté) » décrivent des dossiers
> prévus mais **pas encore présents** sur le disque.

---

## Racine du dépôt

```
AbrisAutoOutaouais-WebApp.slnx          ← solution au format XML .slnx
.gitignore

src/                                    ← projets backend + client Angular
AbrisAutoOutaouais-WebApp.UnitTest/         ← projet de tests unitaires (à la racine)
AbrisAutoOutaouais-WebApp.IntegrationTest/  ← projet de tests d'intégration (à la racine)
```

> Note : les projets de test sont **physiquement à la racine du dépôt**.
> Le fichier `.slnx` les regroupe dans des dossiers de solution virtuels,
> mais sur le disque ils ne sont pas sous un dossier `tests/`.
> Il n'y a **pas** de `Directory.Packages.props` ni de `.editorconfig` à la racine.

---

## Backend (`src/`)

```
src/
├── AbrisAutoOutaouais-WebApp.Domain/
│   ├── AbrisAutoOutaouais-WebApp.Domain.csproj
│   ├── Constants/
│   │   └── Roles.cs                  ★ rôles métier (Customer/Staff/Admin)
│   ├── Entities/
│   │   ├── Product.cs                ★ entité produit avec factory + invariants
│   │   ├── ProductCategory.cs
│   │   ├── ProductImage.cs
│   │   ├── Order.cs                  ★ agrégat commande
│   │   ├── OrderLine.cs
│   │   ├── RentalContract.cs         ★ contrat de location
│   │   └── BookingSlot.cs            ★ créneau d'installation
│   ├── ValueObjects/
│   │   ├── Address.cs                ★ valeur objet adresse (owned entity)
│   │   ├── Money.cs
│   │   └── PhoneNumber.cs
│   ├── Enums/
│   │   ├── OrderStatus.cs
│   │   ├── RentalStatus.cs
│   │   ├── BookingStatus.cs
│   │   ├── BookingType.cs
│   │   └── DeliveryType.cs
│   ├── Events/
│   │   ├── IDomainEvent.cs
│   │   ├── OrderPlacedEvent.cs
│   │   ├── BookingConfirmedEvent.cs
│   │   └── RentalCreatedEvent.cs
│   ├── Exceptions/
│   │   └── DomainExceptions.cs       ★ NotFoundException, ConflictException,
│   │                                   ForbiddenException, BusinessRuleException
│   └── Interfaces/
│       ├── IAuditableEntity.cs
│       └── ISoftDeletable.cs         ★ interface soft delete
│
├── AbrisAutoOutaouais-WebApp.Application/
│   ├── AbrisAutoOutaouais-WebApp.Application.csproj
│   ├── AssemblyMarker.cs
│   ├── Common/
│   │   ├── Interfaces/
│   │   │   ├── IApplicationDbContext.cs  ★
│   │   │   ├── ICurrentUserService.cs
│   │   │   ├── IDateTimeProvider.cs
│   │   │   ├── IEmailService.cs
│   │   │   ├── IFileStorageService.cs
│   │   │   └── IIdentityService.cs
│   │   ├── Mediator/
│   │   │   ├── ICommand.cs           ★ Mediator maison (pas MediatR)
│   │   │   ├── IQuery.cs
│   │   │   ├── ICommandHandler.cs
│   │   │   ├── IQueryHandler.cs
│   │   │   ├── IDispatcher.cs
│   │   │   ├── Dispatcher.cs         ★ implémentation du dispatcher
│   │   │   └── Unit.cs
│   │   ├── Behaviors/
│   │   │   └── ValidationBehavior.cs ★ pipeline FluentValidation
│   │   └── Models/
│   │       ├── Result.cs             ★ Result<T> pattern
│   │       └── PaginatedList.cs
│   │
│   ├── Auth/
│   │   ├── DTOs/
│   │   │   └── AddressDto.cs
│   │   ├── Login/
│   │   │   └── LoginCommand.cs
│   │   └── Register/
│   │       └── RegisterCommand.cs
│   │
│   ├── Products/
│   │   ├── Commands/                 ← commandes à plat (pas de sous-dossier par commande)
│   │   │   ├── CreateProductCommand.cs          ★
│   │   │   ├── CreateProductCommandHandler.cs   ★
│   │   │   └── CreateProductCommandValidator.cs ★
│   │   └── Queries/
│   │       ├── GetProductBySlug/
│   │       │   ├── GetProductBySlugQuery.cs        ★
│   │       │   ├── GetProductBySlugQueryHandler.cs ★
│   │       │   └── ProductDto.cs                   ★
│   │       └── GetAllProducts/
│   │           ├── GetAllProductsQuery.cs
│   │           └── GetAllProductsQueryHandler.cs
│   │
│   ├── Orders/
│   │   └── Commands/
│   │       └── PlaceOrder/
│   │           ├── PlaceOrderCommand.cs          ★
│   │           ├── PlaceOrderCommandHandler.cs   ★
│   │           └── PlaceOrderCommandValidator.cs
│   │
│   └── Bookings/
│       └── Queries/
│           └── GetAvailableSlots/
│               ├── GetAvailableSlotsQuery.cs
│               └── GetAvailableSlotsQueryHandler.cs
│
├── AbrisAutoOutaouais-WebApp.Infrastructure/
│   ├── AbrisAutoOutaouais-WebApp.Infrastructure.csproj
│   ├── DependencyInjection.cs        ★ registration complète
│   ├── Identity/
│   │   ├── AppUser.cs                ★
│   │   ├── AppRole.cs
│   │   ├── TokenService.cs           ★
│   │   ├── IdentityService.cs
│   │   ├── IdentitySeeder.cs
│   │   └── Configurations/
│   │       └── AppUserConfiguration.cs
│   ├── Persistence/
│   │   ├── ApplicationDbContext.cs   ★ contexte unique (gère aussi Identity)
│   │   ├── DesignTimeDbContextFactory.cs
│   │   ├── Interceptors/
│   │   │   ├── SoftDeleteInterceptor.cs  ★
│   │   │   └── AuditInterceptor.cs
│   │   ├── Configurations/
│   │   │   ├── ProductConfiguration.cs  ★
│   │   │   ├── ProductCategoryConfiguration.cs
│   │   │   ├── OrderConfiguration.cs
│   │   │   ├── OrderLineConfiguration.cs
│   │   │   ├── RentalContractConfiguration.cs
│   │   │   └── BookingSlotConfiguration.cs
│   │   └── Migrations/               ← générées par EF (un seul contexte)
│   │       ├── 20260602152216_InitialMigration.cs
│   │       ├── 20260606134425_Fix_01_LaunchAPI.cs
│   │       └── ApplicationDbContextModelSnapshot.cs
│   └── Services/
│       ├── CurrentUserService.cs     ★
│       ├── DateTimeProvider.cs
│       ├── EmailService.cs
│       └── LocalFileStorageService.cs
│
└── AbrisAutoOutaouais-WebApp.API/
    ├── AbrisAutoOutaouais-WebApp.API.csproj
    ├── Program.cs                    ★ composition root complet
    ├── WeatherForecast.cs            ← reliquat de scaffolding
    ├── Middlewares/
    │   └── GlobalExceptionHandler.cs ★ IExceptionHandler → RFC 9457
    └── Controllers/
        ├── AuthController.cs         ★
        ├── ProductsController.cs     ★
        ├── OrdersController.cs
        ├── BookingsController.cs
        └── WeatherForecastController.cs  ← reliquat de scaffolding
```

> Il n'y a **qu'un seul** `ApplicationDbContext` (il gère aussi Identity).
> Pas de `AppIdentityDbContext`, pas de dossier `Identity/Migrations`.

### Cible / à venir (non encore implémenté) — Backend

- `Application/Products/Commands` : `UpdateProduct*`, `DeleteProduct*`.
- `Application/Orders` : `CancelOrder*`, `Queries/GetMyOrders`, `Queries/GetOrderById`.
- `Application/Bookings/Commands` : `CreateBooking*`, `ConfirmBooking*`,
  `Application/Bookings/Queries/GetMyBookings`.
- `Application/Rentals/` : dossier complet (commandes + queries de location).
- `API/Controllers/RentalsController.cs`.

---

## Frontend (`src/AbrisAutoOutaouais-WebApp.Client/`)

```
src/AbrisAutoOutaouais-WebApp.Client/
├── AbrisAutoOutaouais-WebApp.Client.esproj
├── package.json
├── angular.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
├── vitest.config.ts
├── karma.conf.js
├── .eslintrc.json
├── .prettierrc
├── .editorconfig
├── .gitignore
├── README.md
├── CHANGELOG.md
│
└── src/
    ├── main.ts
    ├── main.server.ts
    ├── server.ts
    ├── index.html
    ├── styles.scss
    ├── test-setup.ts
    │
    ├── environments/
    │   ├── environment.ts            ★
    │   └── environment.prod.ts
    │
    └── app/
        ├── app.ts                    ★ composant racine
        ├── app.html
        ├── app.scss
        ├── app.spec.ts
        ├── app.routes.ts             ★ routes lazy-loaded
        ├── app.config.ts             ★ providers + interceptors
        ├── app.config.server.ts
        │
        ├── core/
        │   ├── services/
        │   │   ├── auth.service.ts   ★
        │   │   ├── cart.service.ts   ★
        │   │   ├── theme.service.ts
        │   │   └── toast.service.ts
        │   ├── interceptors/
        │   │   ├── auth.interceptor.ts       ★
        │   │   ├── error.interceptor.ts
        │   │   ├── http-error.interceptor.ts
        │   │   └── jwt.interceptor.ts
        │   ├── guards/
        │   │   ├── auth.guard.ts     ★
        │   │   ├── admin.guard.ts
        │   │   └── public.guard.ts
        │   └── models/
        │       ├── product.model.ts  ★
        │       └── booking.model.ts
        │
        ├── shared/
        │   ├── styles/
        │   │   ├── _tokens.scss      ★ design tokens (couleurs, spacing, typo)
        │   │   ├── _breakpoints.scss
        │   │   └── _a11y.scss
        │   ├── components/
        │   │   ├── a11y-components/
        │   │   │   ├── a11y-components.component.ts
        │   │   │   ├── accordion/
        │   │   │   │   ├── a11y-accordion.component.ts
        │   │   │   │   └── a11y-accordion.component.spec.ts
        │   │   │   ├── data-table/
        │   │   │   │   ├── data-table.component.ts
        │   │   │   │   └── a11y-data-table.component.spec.ts
        │   │   │   ├── form/
        │   │   │   │   ├── a11y-form.component.ts
        │   │   │   │   └── a11y-form.component.spec.ts
        │   │   │   ├── inspection/
        │   │   │   │   ├── inspection-panel.component.ts
        │   │   │   │   ├── inspection.model.ts
        │   │   │   │   ├── inspection.data.ts
        │   │   │   │   └── accordion.data.ts
        │   │   │   └── modal/
        │   │   │       ├── a11y-modal.component.ts
        │   │   │       └── a11y-modal.component.spec.ts
        │   │   ├── alert/
        │   │   │   ├── alert.ts
        │   │   │   ├── alert.html
        │   │   │   └── alert.scss
        │   │   └── product-card/
        │   │       ├── product-card.ts  ★
        │   │       ├── product-card.html
        │   │       └── product-card.scss
        │   └── layout/
        │       ├── navbar/
        │       │   ├── navbar.ts     ★
        │       │   ├── navbar.html
        │       │   └── navbar.scss
        │       ├── footer/
        │       │   ├── footer.ts
        │       │   ├── footer.html
        │       │   └── footer.scss
        │       └── skip-nav/
        │           ├── skip-nav.ts
        │           └── skip-nav.html
        │
        └── features/
            ├── home/
            │   ├── home.ts          ★
            │   ├── home.html
            │   └── home.scss
            │
            ├── auth/
            │   ├── auth.ts
            │   ├── auth.html
            │   ├── auth.scss
            │   ├── auth.routes.ts
            │   ├── login/
            │   │   ├── login.ts     ★
            │   │   ├── login.html
            │   │   └── login.scss
            │   ├── register/
            │   │   └── register.component.ts
            │   └── me/
            │       ├── profile.ts
            │       ├── profile.html
            │       └── profile.scss
            │
            └── account/
                ├── account.routes.ts
                └── profile/
                    ├── profile.ts
                    ├── profile.html
                    └── profile.scss
```

> i18n : pas de dossier `i18n/messages.*.xlf`. L'extraction i18n sort vers `src/locale`
> (commande `npm run i18n:extract`), dossier généré uniquement au besoin.
> Les fichiers de composant suivent le nouveau nommage Angular (`home.ts/.html/.scss`, `app.ts`).

### Cible / à venir (non encore implémenté) — Frontend

- `shared/styles/_mixins.scss`.
- `shared/components/button/`.
- `shared/pipes/` (`currency-cad.pipe.ts`, `booking-status.pipe.ts`).
- `core/models/` : `auth.model.ts`, `order.model.ts`, `rental.model.ts`.
- Features `shop/` (catalog, product-detail, cart), `checkout/`, `rental/`,
  `booking/`, et `admin/` (dashboard, products-manage, orders-manage, bookings-manage).
- `account/` : `my-orders/`, `my-rentals/`.

---

## GitHub Actions (`.github/workflows/`) — à venir

Aucun dossier `.github/` n'existe encore dans le dépôt. CI/CD planifiée :

```
.github/
└── workflows/
    ├── frontend.yml    ← CI sur PR : vitest + lint + build prod
    └── backend.yml     ← CI/CD sur push main : build + test + deploy Azure
```
