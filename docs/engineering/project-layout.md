# Arborescence du projet (AbrisTempo Local)

Carte concise de l'organisation réelle du dépôt. Clean Architecture, dépendances vers l'intérieur
uniquement : **Domain ← Application ← Infrastructure / API**, plus le client Angular.

> **Un seul `ApplicationDbContext`** (gère Identity **et** le domaine) — il n'y a **pas** de
> `AppIdentityDbContext` ni de dossier `Identity/Migrations`. Les migrations sont sous
> `Infrastructure/Persistence/Migrations`. Voir [`identity.md`](identity.md).

---

## Racine du dépôt

```
AbrisAutoOutaouais-WebApp.slnx           ← solution au format XML .slnx
CLAUDE.md  CONTRIBUTING.md  README.md
Dockerfile  azure-pipelines.yml  package.json
docs/                                    ← documentation portfolio + ingénierie (ce dossier)
infra/                                   ← Terraform (IaC Azure)
src/                                     ← projets backend + client Angular
AbrisAutoOutaouais-WebApp.UnitTest/         ← tests unitaires (xUnit v3, à la racine)
AbrisAutoOutaouais-WebApp.IntegrationTest/  ← tests d'intégration (WebApplicationFactory, à la racine)
```

> Les projets de test sont **physiquement à la racine** (pas sous `tests/`) ; le `.slnx` les
> regroupe dans des dossiers de solution virtuels.

---

## Backend (`src/`)

```
src/
├── AbrisAutoOutaouais-WebApp.Domain/        # zéro dépendance externe
│   ├── Common/                              # primitives partagées du domaine
│   ├── Constants/                           # Roles, ProductDimensions, ShelterFit, ExcludedShelterBrands
│   ├── Entities/                            # Product, ProductCategory, ProductImage, Order, OrderLine,
│   │                                        #   RentalContract, BookingSlot, ShelterModel,
│   │                                        #   ShelterModelDimension, ShelterPriceEntry, WorkHoursEntry
│   ├── Enums/                               # OrderStatus, RentalStatus, BookingStatus, DeliveryType, …
│   ├── Events/                              # IDomainEvent + événements de domaine
│   ├── Exceptions/                          # NotFoundException, ConflictException, ForbiddenException, …
│   ├── Interfaces/                          # IAuditableEntity, ISoftDeletable
│   ├── Services/                            # services de domaine purs
│   └── ValueObjects/                        # Address, Money, PhoneNumber
│
├── AbrisAutoOutaouais-WebApp.Application/    # dépend uniquement de Domain
│   ├── AssemblyMarker.cs                     # marqueur d'assembly (Scrutor + FluentValidation)
│   ├── Common/
│   │   ├── Interfaces/                       # IApplicationDbContext, IIdentityService, ICurrentUserService,
│   │   │                                     #   IPlacesService, IPaymentService, IEmailService, …
│   │   ├── Mediator/                         # Mediator MAISON : ICommand, IQuery, ICommandHandler,
│   │   │                                     #   IQueryHandler, IDispatcher, Dispatcher, Unit
│   │   ├── Behaviors/                        # ValidationBehavior (pipeline FluentValidation)
│   │   └── Models/                           # Result<T>, PaginatedList<T>
│   ├── Auth/  Bookings/  Catalog/  Categories/  Customers/  Orders/  Payments/
│   ├── Payroll/  Places/  Planning/  Products/  Rentals/  Shelters/  Users/
│   │                                         # une feature = Commands/ + Queries/, validateur dans
│   │                                         #   le même dossier que sa commande/query
│
├── AbrisAutoOutaouais-WebApp.Infrastructure/ # implémente les interfaces d'Application
│   ├── DependencyInjection.cs                # AddInfrastructure : DbContext, Identity, JWT, Scrutor,
│   │                                         #   validateurs, services (composition complète)
│   ├── Identity/                             # AppUser, AppRole, IdentityService, TokenService,
│   │   └── Configurations/                   #   IdentitySeeder, ExpressAccountService, AppUserConfiguration
│   ├── Persistence/
│   │   ├── ApplicationDbContext.cs           # contexte UNIQUE (Identity + domaine)
│   │   ├── DesignTimeDbContextFactory.cs
│   │   ├── Configurations/                   # IEntityTypeConfiguration<T> par entité
│   │   ├── Interceptors/                     # SoftDeleteInterceptor, AuditInterceptor
│   │   ├── Data/  ProductSeeder.cs  ShelterModelSeeder.cs
│   │   └── Migrations/                       # EF migrations (un seul contexte)
│   └── Services/                             # CurrentUserService, DateTimeProvider, EmailService,
│       ├── Payments/                         #   LocalFileStorageService, ClientUrlProvider,
│       └── Places/                           #   adaptateurs Payments & Places (Photon/Radar/Google)
│
└── AbrisAutoOutaouais-WebApp.API/            # composition root, controllers minces
    ├── Program.cs                            # pipeline + AddInfrastructure + IDispatcher + seeder
    ├── Middlewares/                          # GlobalExceptionHandler (IExceptionHandler → RFC 9457)
    └── Controllers/                          # Auth, Products, Catalog, Categories, Orders, Rentals,
                                              #   Bookings, Planning, Payroll, Places, Shelters, Users
```

---

## Frontend (`src/AbrisAutoOutaouais-WebApp.Client/`)

```
src/AbrisAutoOutaouais-WebApp.Client/
├── package.json  angular.json  vitest.config.ts  playwright.config.ts
├── e2e/                                      # specs Playwright (+ @axe-core/playwright)
└── src/
    ├── main.ts  main.server.ts  server.ts    # bootstrap client + SSR
    ├── index.html  styles.scss
    ├── environments/                         # environment(.prod|.staging).ts
    ├── locale/                               # i18n extrait : messages.xlf (fr) + messages.en.xlf (en)
    ├── styles/                               # _tokens.scss, _a11y.scss, _breakpoints.scss
    ├── testing/                              # axe-helper.ts (color-contrast désactivé en vitest)
    └── app/
        ├── app.ts  app.routes.ts  app.config.ts  app.config.server.ts
        ├── core/                             # services singletons, guards, interceptors, models
        ├── shared/                           # composants réutilisables, layout (navbar/footer/skip-nav),
        │   └── components/a11y-components/    #   styles, et la trousse a11y
        └── features/                         # routes lazy par domaine :
                                              #   home, shop, cart, checkout, location, installation,
                                              #   mesurer, account, admin, auth, legal
```

Conventions de nommage Angular : fichiers `nom.ts` / `nom.html` / `nom.scss` (composants
standalone). Les chaînes i18n FR vivent dans `messages.xlf`, les cibles EN dans `messages.en.xlf`.

---

## Pour aller plus loin

- Auth/authz : [`identity.md`](identity.md).
- Ajouter un cas d'usage : [`adding-a-feature.md`](adding-a-feature.md).
- Patrons de conception ancrés au code : [`../design-patterns.md`](../design-patterns.md).
- Conventions rapides + système d'agents : `CLAUDE.md` racine + `.claude/`.
