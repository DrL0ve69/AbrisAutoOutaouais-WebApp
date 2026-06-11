# Implementation Guide - Phase 1: Identity & Authentication

## ✅ Completed Tasks

### Backend (ASP.NET Core)
1. **Identity Layer** (`Infrastructure/Identity/`)
   - ✅ `AppUser.cs` - Extended IdentityUser with profile fields
   - ✅ `AppRole.cs` - Custom role class
   - ✅ `DeliveryAddress.cs` - Owned Entity for delivery address
   - ✅ `TokenService.cs` - JWT token generation
   - ✅ `IdentityService.cs` - Authentication & authorization logic
   - ✅ `CurrentUserService.cs` - Extract current user from JWT claims

2. **Domain Layer**
   - ✅ `Constants/Roles.cs` - Role constants (Customer, Staff, Admin)
   - ✅ `Interfaces/ISoftDeletable.cs` - Soft delete interface
   - ✅ `Exceptions/DomainExceptions.cs` - Custom exceptions

3. **Application Layer** (`Application/Common/`)
   - ✅ `Interfaces/IApplicationDbContext.cs` - DbContext abstraction
   - ✅ `Interfaces/IIdentityService.cs` - Auth service interface
   - ✅ `Interfaces/ICurrentUserService.cs` - Current user interface
   - ✅ `Mediator/ICommand.cs`, `IQuery.cs`, `ICommandHandler.cs`, `IQueryHandler.cs`, `IDispatcher.cs`, `Unit.cs` - CQRS interfaces
   - ✅ `Mediator/Dispatcher.cs` - Mediator implementation
   - ✅ `Authentication/Register/RegisterCommand.cs` - Register command + handler
   - ✅ `Authentication/Login/LoginCommand.cs` - Login command + handler

4. **Infrastructure**
   - ✅ `Persistence/ApplicationDbContext.cs` - Single DbContext for all entities
   - ✅ `DependencyInjection.cs` - DI registration for all services
   - ✅ Updated `Infrastructure.csproj` with NuGet packages

5. **API Layer**
   - ✅ `Controllers/AuthController.cs` - Auth endpoints (register, login, me)
   - ✅ Updated `Program.cs` with Identity, JWT, and CORS setup
   - ✅ Updated `appsettings.json` and `appsettings.Development.json`

### Frontend (Angular 21)
1. **Core Services & Interceptors**
   - ✅ `core/services/auth.service.ts` - Auth API client with signal-based state
   - ✅ `core/interceptors/jwt.interceptor.ts` - JWT injection interceptor
   - ✅ `core/guards/auth.guard.ts` - Route protection guard

2. **Features Components**
   - ✅ `features/auth/login/login.component.ts` - Login UI with validation
   - ✅ `features/auth/register/register.component.ts` - Register UI with password matching
   - ✅ `features/home/home.component.ts` - Home page with user info & logout

3. **Routing & Module Setup**
   - ✅ Updated `app-routing-module.ts` with auth routes
   - ✅ Updated `app-module.ts` with HttpClient, JWT interceptor, Router
   - ✅ Updated `app.ts` with RouterModule import
   - ✅ Updated `app.html` with router-outlet

---

## 🚀 Quick Start

### Prerequisites
- .NET SDK 10.x
- Node.js 22 LTS
- SQL Server LocalDB (or PostgreSQL with Npgsql)

### Backend Setup

1. **Restore NuGet packages**
   ```bash
   cd src/AbrisAutoOutaouais-WebApp.API
   dotnet restore
   ```

2. **Set up user secrets** (Development only - in production use Azure Key Vault)
   ```bash
   cd src/AbrisAutoOutaouais-WebApp.API

   # JWT
   dotnet user-secrets set "Jwt:Key" "AbrisTempoLocal_SuperSecret_Key_min32chars!"
   dotnet user-secrets set "Jwt:Issuer" "AbrisTempoLocal.Api"
   dotnet user-secrets set "Jwt:Audience" "AbrisTempoLocal.Client"

   # Database connection (clé : DefaultConnection, base : AbrisTempoDb)
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=(localdb)\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;"
   ```

3. **Create initial migration** (un seul DbContext — depuis la racine de la solution)
   ```bash
   dotnet ef migrations add InitialCreate \
     --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
     --startup-project src/AbrisAutoOutaouais-WebApp.API \
     --output-dir Persistence/Migrations

   dotnet ef database update \
     --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
     --startup-project src/AbrisAutoOutaouais-WebApp.API
   ```

4. **Start the API**
   ```bash
   dotnet run --project src/AbrisAutoOutaouais-WebApp.API
   ```
   - API will be available at: `https://localhost:5001` or `http://localhost:5000`
   - Scalar UI (OpenAPI docs): `https://localhost:5001/scalar`
   - Default admin user (seedé par `IdentitySeeder.SeedAsync`):
     - Email: `admin@abrisauto.com`
     - Password: `Admin123!`

### Frontend Setup

1. **Install dependencies**
   ```bash
   cd src/AbrisAutoOutaouais-WebApp.Client
   npm install
   ```

2. **Update API URL in AuthService**
   - The default API URL is `http://localhost:5000/api/v1`
   - If your backend runs on a different port, update `auth.service.ts`

3. **Start dev server**
   ```bash
   cd src/AbrisAutoOutaouais-WebApp.Client
   npm start
   # or
   ng serve
   ```
   - Frontend will be available at: `http://localhost:4200`

---

## 🧪 Testing the Auth Flow

### 1. Test User Registration
1. Navigate to `http://localhost:4200/register`
2. Fill in the form:
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john@example.com`
   - Password: `TestPassword123!`
   - Confirm Password: `TestPassword123!`
3. Click "S'inscrire"
4. You should be redirected to `/home`

### 2. Test User Login
1. Navigate to `http://localhost:4200/login`
2. Use credentials:
   - Email: `john@example.com`
   - Password: `TestPassword123!`
3. Click "Se connecter"
4. You should see your profile info on the home page

### 3. Test with Admin Account
1. Navigate to `http://localhost:4200/login`
2. Use:
   - Email: `admin@abrisauto.com`
   - Password: `Admin123!`
3. You should see "Admin" role in your user info

### 4. Test Protected Routes
- Try accessing `/home` without logging in - you should be redirected to `/login`
- Log out and verify you're redirected to `/login`

### 5. Test JWT Token
1. Open DevTools (F12) → Application → Local Storage
2. After login, you should see `auth_token` with a JWT token
3. Open the Network tab and make an authenticated request - the token should be in the `Authorization` header

---

## 📁 File Structure Created

```
Backend:
src/AbrisAutoOutaouais-WebApp.Infrastructure/
├── Identity/
│   ├── AppUser.cs
│   ├── AppRole.cs
│   ├── DeliveryAddress.cs
│   ├── TokenService.cs
│   ├── IdentityService.cs
│   └── CurrentUserService.cs
├── Persistence/
│   └── ApplicationDbContext.cs
└── DependencyInjection.cs

src/AbrisAutoOutaouais-WebApp.Application/
├── Common/
│   ├── Interfaces/
│   │   ├── IApplicationDbContext.cs
│   │   ├── IIdentityService.cs
│   │   ├── ICurrentUserService.cs
│   └── Mediator/
│       ├── ICommand.cs
│       ├── IQuery.cs
│       ├── ICommandHandler.cs
│       ├── IQueryHandler.cs
│       ├── IDispatcher.cs
│       ├── Unit.cs
│       └── Dispatcher.cs
└── Authentication/
    ├── Login/
    │   └── LoginCommand.cs
    └── Register/
        └── RegisterCommand.cs

src/AbrisAutoOutaouais-WebApp.API/
├── Controllers/
│   └── AuthController.cs
├── Program.cs
├── appsettings.json
└── appsettings.Development.json

src/AbrisAutoOutaouais-WebApp.Domain/
├── Constants/
│   └── Roles.cs
├── Interfaces/
│   └── ISoftDeletable.cs
└── Exceptions/
    └── DomainExceptions.cs

Frontend:
src/AbrisAutoOutaouais-WebApp.Client/src/app/
├── core/
│   ├── services/
│   │   └── auth.service.ts
│   ├── interceptors/
│   │   └── jwt.interceptor.ts
│   └── guards/
│       └── auth.guard.ts
├── features/
│   ├── auth/
│   │   ├── login/
│   │   │   └── login.component.ts
│   │   └── register/
│   │       └── register.component.ts
│   └── home/
│       └── home.component.ts
├── app.ts
├── app-routing-module.ts
└── app-module.ts
```

---

## 🔐 Security Notes

### Current Implementation
- ✅ JWT tokens with 24-hour expiry
- ✅ Password validation (8+ chars, upper/lower/digit/special)
- ✅ HTTPS redirection
- ✅ CORS configured for localhost:4200
- ✅ Token stored in localStorage (XSS risk - consider sessionStorage for production)

### TODO for Production
- [ ] Move JWT token to httpOnly cookie
- [ ] Implement refresh token mechanism
- [ ] Add rate limiting on auth endpoints
- [ ] Add email verification
- [ ] Implement 2FA
- [ ] Add CSRF protection
- [ ] Use HTTPS in production
- [ ] Add role-based access control (RBAC) on API endpoints
- [ ] Audit logging for auth events

---

## 🛠️ Troubleshooting

### Migration Issues
```bash
# Un seul DbContext (ApplicationDbContext) — --context inutile.
# If migration failed, remove it
dotnet ef migrations remove \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API

# Recreate
dotnet ef migrations add InitialCreate \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API \
  --output-dir Persistence/Migrations
```

### Database Connection Issues
```bash
# Check if localdb is running
sqllocaldb info

# Start localdb if needed
sqllocaldb start mssqllocaldb
```

### CORS Issues
- Check `AllowedOrigins` in `appsettings.Development.json`
- Frontend should be at `http://localhost:4200`
- Backend should be at `http://localhost:5000` or `https://localhost:5001`

### JWT Decode
- Use https://jwt.io to decode and inspect your JWT token
- Verify the claims and expiry date

---

## 📝 Next Steps

### Phase 2: Product Catalog (Planned)
- [ ] Create Product entity
- [ ] Create ProductCategory entity
- [ ] Implement product queries
- [ ] Create product listing component
- [ ] Add product detail page

### Phase 3: Shopping Cart & Orders
- [ ] Implement shopping cart state management
- [ ] Create order commands
- [ ] Add checkout process
- [ ] Email notifications

### Phase 4: Rental & Booking
- [ ] Create RentalContract entity
- [ ] Create BookingSlot entity
- [ ] Calendar UI for bookings
- [ ] Payment integration (Stripe)

---

## 📚 References

- [ASP.NET Core Identity Documentation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity)
- [JWT Token Implementation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt)
- [Angular Security Best Practices](https://angular.io/guide/security)
- [Angular HttpClient & Interceptors](https://angular.io/guide/http-client)
- [Angular Signals](https://angular.io/guide/signals)
