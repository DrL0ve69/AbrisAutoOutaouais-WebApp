# PROJECT_CONTEXT.md — AbrisTempo Local

Résumé du contexte métier et des décisions techniques. À copier-coller dans Claude pour reprendre le travail sans tout réexpliquer.

---

## Qui / Quoi

**Développeur** : stagiaire finissant en programmation web (Montréal, QC), cherche un emploi.
**Client** : père, représentant régional de la marque *Abris Tempo* (abris d'auto temporaires).
Site du fabricant de référence : <https://www.abristempo.com/en>

**Double objectif** :
1. Démontrer ses compétences en entretien d'embauche.
2. Rendre l'application fonctionnelle et déployable pour le père.

---

## Services offerts

| Service | Description | Module |
|---------|-------------|--------|
| **Vente** | Catalogue produits + panier + paiement en ligne | `features/shop` |
| **Livraison** | Option livrée à domicile ou ramassage | Inclus dans commande |
| **Location** | Abris saisonniers (contrat de location) | `features/rental` |
| **Installation** | Service à domicile, planifié par calendrier | `features/booking` |

---

## Produits (inspirés d'Abris Tempo)

| Catégorie | Exemples |
|-----------|---------|
| Abris simples | Abri simple, abri monopente |
| Abris doubles | Abri double (2 voitures) |
| Abris de rangement | Atelier, remise |
| Abris industriels | Grands formats commerciaux |
| Toiles de remplacement | Toiles par modèle + couleur |
| Accessoires | Ancres, pièces, fixations |

---

## Entités Domain principales

```
Product          — SKU, nom, description, prix, catégorie, stock, images
ProductCategory  — Abri / Accessoire / Toile / Location
Order            — lignes, client, livraison, statut, paiement
OrderLine        — produit, qté, prix snapshot
RentalContract   — client, produit loué, période, tarif/mois, statut
BookingSlot      — date/heure, type (installation/livraison), durée, adresse
Customer         — profil étendu d'ApplicationUser
Address          — valeur objet partagée (VO)
```

---

## Stack technique décidée

### Backend

| Couche | Technologie |
|--------|------------|
| Runtime | .NET 10 (LTS) |
| API | ASP.NET Core Controllers + API Versioning |
| ORM | Entity Framework Core 10 (SQL Server ou PostgreSQL) |
| Auth | ASP.NET Core Identity + JWT Bearer |
| CQRS | Mediator Pattern maison (pas MediatR) |
| Validation | FluentValidation |
| Docs | Scalar (OpenAPI 3.1) |
| Tests | xUnit + FluentAssertions + WebApplicationFactory |

### Frontend

| Couche | Technologie |
|--------|------------|
| Framework | Angular 20+ (SSR via @angular/ssr) |
| État | Signals (`signal`, `computed`, `effect`) |
| Forms | Reactive Forms |
| Styles | SCSS + design tokens |
| Tests | Vitest + Angular Testing Library |
| i18n | Angular i18n (FR par défaut, EN optionnel) |

### Infrastructure

| Composant | Choix |
|-----------|-------|
| Frontend | Vercel |
| Backend | Azure App Service |
| Base de données | Azure SQL / PostgreSQL |
| Secrets | Azure Key Vault |
| CI/CD | GitHub Actions |
| Emails | (à définir — SendGrid ou Azure Communication) |
| Paiements | Stripe (intégration future) |

---

## Architecture — règles non négociables

1. **Pas de Repository Pattern générique** — `IApplicationDbContext` injecté directement dans les handlers (recommandation 2025-2026 : EF Core DbContext *est* déjà une abstraction).
2. **`sealed record`** pour tous les DTOs, Commands, Queries.
3. **Mediator maison** — interface `ICommandHandler<TCmd, TResult>` / `IQueryHandler<TQuery, TResult>` dans `Application/Common`.
4. **Soft Delete** via `SaveChangesInterceptor` + `ISoftDeletable` + named query filter.
5. **Constantes de rôles** dans `Domain/Constants/Roles.cs` (pas dans Api).
6. **Zéro logique** dans les controllers — ils dispatchent vers le Mediator et retournent le résultat.
7. **`Result<T>`** (ErrorOr) pour les chemins d'erreur attendus en Application.

---

## Décisions de design notables

### Pourquoi pas de Repository générique ?

`DbContext` implémente déjà Unit of Work + le pattern de collection.
Ajouter `IRepository<T>` crée du boilerplate sans valeur (test avec EF Core InMemory ou SQLite = suffisant).
Source : levelup.gitconnected.com (2026) + codewithmukesh.com.

### Pourquoi Mediator maison ?

MediatR est devenu payant pour usage commercial.
Un Mediator source-generated (`Mediator` NuGet de martinothamar) ou une implémentation maison simple est suffisant et performant.

### Pourquoi deux DbContext ?

- `AppIdentityDbContext` : tables ASP.NET Core Identity (Users, Roles, Claims).
- `ApplicationDbContext` : entités métier (Products, Orders, Bookings…).

Séparation claire = migrations indépendantes, contextes testables séparément.

---

## Flux principaux

### Achat d'un produit

```
Client → Parcourir catalogue → Ajouter au panier → Checkout
→ Choisir livraison ou ramassage → Paiement (Stripe)
→ OrderCreatedCommand → Email de confirmation → Suivi commande
```

### Location d'un abri

```
Client → Page Location → Choisir modèle + période
→ CreateRentalContractCommand → Avis de paiement mensuel
→ Statut : Actif / Expiré / Annulé
```

### Réservation d'installation

```
Client → Page Installation → Voir créneaux disponibles
→ Sélectionner créneau + adresse → CreateBookingCommand
→ Email de confirmation au client + au représentant
→ Statut : En attente / Confirmé / Complété / Annulé
```

---

## Variables d'environnement requises

```bash
# Backend (user-secrets en dev, Key Vault en prod)
Jwt__Key=<min-32-chars>
Jwt__Issuer=AbrisTempoLocal.Api
Jwt__Audience=AbrisTempoLocal.Client
ConnectionStrings__Identity=<conn-string>
ConnectionStrings__Application=<conn-string>
AllowedOrigins=http://localhost:4200,https://abristempo.vercel.app
Stripe__SecretKey=<stripe-key>

# Frontend (environment.ts / Vercel env vars)
API_URL=https://api.abristempo.com
STRIPE_PUBLIC_KEY=<stripe-pk>
```

---

## Rôles

| Rôle | Accès |
|------|-------|
| `Customer` | Parcourir, acheter, louer, réserver, voir ses commandes |
| `Staff` | Voir et gérer toutes les commandes/réservations |
| `Admin` | Gestion complète (produits, utilisateurs, rapports) |

Définis dans `Domain/Constants/Roles.cs`.
