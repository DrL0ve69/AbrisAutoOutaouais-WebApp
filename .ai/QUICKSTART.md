# QUICKSTART.md — AbrisTempo Local

Guide de démarrage rapide pour lancer le projet depuis zéro.

---

## Prérequis

| Outil | Version | Installation |
|-------|---------|-------------|
| .NET SDK | 10.x | https://dotnet.microsoft.com/download |
| Node.js | 22 LTS | https://nodejs.org |
| Angular CLI | 20+ | `npm install -g @angular/cli` |
| SQL Server LocalDB | Inclus avec VS | ou PostgreSQL via Npgsql |
| EF Core Tools | | `dotnet tool install -g dotnet-ef` |

---

## 1. Cloner et configurer

```bash
git clone <repo-url>
cd AbrisAutoOutaouais-WebApp
# Solution : AbrisAutoOutaouais-WebApp.slnx (format XML .slnx)
```

---

## 2. Secrets de développement (Backend)

```bash
cd src/AbrisAutoOutaouais-WebApp.API

# JWT
dotnet user-secrets set "Jwt:Key" "AbrisTempoLocal_SuperSecret_Key_min32chars!"
dotnet user-secrets set "Jwt:Issuer" "AbrisAutoOutaouais.API"
dotnet user-secrets set "Jwt:Audience" "AbrisAutoOutaouais.CLIENT"

# Base de données — un seul DbContext, une seule chaîne de connexion
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Server=(localdb)\mssqllocaldb;Database=AbrisTempoDb;Trusted_Connection=true;MultipleActiveResultSets=true;TrustServerCertificate=True"

dotnet user-secrets set "AllowedOrigins" "http://localhost:4200"
```

---

## 3. Migrations EF Core

```bash
# Depuis la racine de la solution
# Un seul DbContext (ApplicationDbContext) : Identity + entités métier dans la même base.
# Migrations existantes : InitialMigration, Fix_01_LaunchAPI.

# Ajouter une migration (--context optionnel puisqu'il n'y a qu'un contexte)
dotnet ef migrations add <Name> \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API \
  --output-dir Persistence/Migrations

# Appliquer
dotnet ef database update \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API
```

---

## 4. Démarrer le Backend

```bash
dotnet run --project src/AbrisAutoOutaouais-WebApp.API
# API disponible sur https://localhost:5001 ou http://localhost:5000
# Scalar UI : https://localhost:5001/scalar
```

---

## 5. Démarrer le Frontend

```bash
cd src/AbrisAutoOutaouais-WebApp.Client
npm install
npm start   # ng serve --host=127.0.0.1
# Frontend disponible sur http://localhost:4200
```

---

## 6. Compte admin par défaut

Le seeder crée automatiquement au premier démarrage :

| Champ | Valeur |
|-------|--------|
| Email | `admin@abrisauto.com` |
| Mot de passe | `Admin123!` |
| Rôle | `Admin` |

---

## 7. Vérifier que tout fonctionne

```bash
# Test 1 — Liste des produits (public)
curl http://localhost:5000/api/v1/products

# Test 2 — Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@abrisauto.com","password":"Admin123!"}'

# Test 3 — Créneaux disponibles
curl http://localhost:5000/api/v1/bookings/available-slots

# Test 4 — Frontend
# Ouvrir http://localhost:4200 dans le navigateur
```

---

## 8. Structure des branches

```bash
git checkout -b feat/product-catalog    # Nouvelle feature
git checkout -b fix/booking-conflict    # Bug fix
git checkout -b a11y/focus-trap-modal   # Accessibilité
```

---

## 9. Déploiement (résumé)

### Frontend → Vercel
- Connecter le repo GitHub à Vercel.
- Build command : `ng build --configuration production`
- Output directory : `dist/client/browser`
- Variables d'env : `API_URL`, `STRIPE_PUBLIC_KEY`

### Backend → Azure App Service
- GitHub Actions (voir `.github/workflows/backend.yml`).
- Secrets : Azure Key Vault (`Jwt:Key`, `ConnectionStrings:*`).
- Runtime : .NET 10.

---

## Commandes utiles au quotidien

```bash
# Tests backend
dotnet test --no-build
dotnet test AbrisAutoOutaouais-WebApp.UnitTest   # projet unique

# Tests frontend (depuis src/AbrisAutoOutaouais-WebApp.Client)
npm test

# Ajouter une migration backend
dotnet ef migrations add <NomDeMigration> \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API \
  --output-dir Persistence/Migrations

# Annuler la dernière migration
dotnet ef migrations remove \
  --project src/AbrisAutoOutaouais-WebApp.Infrastructure \
  --startup-project src/AbrisAutoOutaouais-WebApp.API
```
