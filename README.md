# AbrisTempo Local — Plateforme e‑commerce & réservation

> Application web **full‑stack** (.NET 10 / C# 14 + Angular 21) pour un représentant régional de
> la marque [Abris Tempo](https://www.abristempo.com/en) (Outaouais, QC) : **vente de produits**
> avec livraison, **location saisonnière** d'abris et **réservation d'installation** à domicile.

<p>
  <img alt=".NET 10" src="https://img.shields.io/badge/.NET-10-512BD4">
  <img alt="C# 14" src="https://img.shields.io/badge/C%23-14-239120">
  <img alt="Angular 21" src="https://img.shields.io/badge/Angular-21-DD0031">
  <img alt="WCAG 2.2 AA" src="https://img.shields.io/badge/WCAG-2.2%20AA-0A7B34">
  <img alt="Tests" src="https://img.shields.io/badge/tests-xUnit%20%7C%20Vitest%20%7C%20Playwright-success">
</p>

Ce dépôt est un **projet portfolio** qui met en pratique : architecture logicielle propre,
sécurité web, **accessibilité (WCAG 2.2 AA)**, **évaluation UX**, internationalisation, tests
automatisés et pratiques **Agile/DevOps**.

---

## Sommaire
- [Aperçu fonctionnel](#aperçu-fonctionnel)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Sécurité](#sécurité)
- [Accessibilité & UX](#accessibilité--ux)
- [Internationalisation](#internationalisation)
- [Stratégie de tests](#stratégie-de-tests)
- [DevOps & Agile](#devops--agile)
- [Démarrage rapide](#démarrage-rapide)
- [Structure du projet](#structure-du-projet)
- [Feuille de route](#feuille-de-route)
- [Compétences démontrées](#compétences-démontrées)

---

## Aperçu fonctionnel

| Domaine | Description |
|---|---|
| 🛒 **Vente** | Catalogue d'abris filtrable par catégorie, fiche produit, panier, livraison. |
| 📅 **Location** | Abris saisonniers (tarif mensuel). |
| 🔧 **Installation** | Réservation de créneaux d'installation/démontage à domicile. |
| 👤 **Comptes** | Inscription/connexion (courriel **ou** nom d'utilisateur), profil, rôles. |

Un **seeder** initialise au démarrage 7 catégories et 12 produits inspirés de la gamme Abris Tempo,
ainsi qu'un compte administrateur.

## Stack technique

**Backend** — .NET 10 / C# 14 · ASP.NET Core (controllers + API Versioning) · EF Core 10 (SQL Server) ·
ASP.NET Core Identity + JWT · FluentValidation · **Mediator maison** (CQRS) · Scalar/OpenAPI ·
xUnit v3 + FluentAssertions + NSubstitute.

**Frontend** — Angular 21 (standalone, **signals**, contrôle de flux natif) · SSR (`@angular/ssr`) ·
i18n compile‑time (fr/en) · SCSS + design tokens · **Vitest (mode navigateur) + Playwright** ·
**axe‑core** pour l'accessibilité.

## Architecture

**Clean Architecture + CQRS.** Les dépendances pointent **toujours vers l'intérieur** :

```
        ┌──────────────────────────────────────────────┐
        │                    Domain                     │  Entités, Value Objects, enums,
        │           (aucune dépendance externe)         │  événements, exceptions, interfaces
        └──────────────────────────────────────────────┘
                         ▲
        ┌────────────────┴─────────────────────────────┐
        │                 Application                   │  CQRS (ICommand/IQuery + handlers),
        │        (dépend seulement de Domain)           │  DTOs (sealed record), validateurs
        └────────────────┬─────────────────────────────┘
                  ▲       │       ▲
   ┌──────────────┴──┐    │   ┌───┴────────────────┐
   │  Infrastructure │◄───┘   │        API         │  Controllers (minces), middleware,
   │  EF Core, JWT,  │        │  composition root  │  GlobalExceptionHandler (RFC 9457)
   │  Identity, …    │        └────────────────────┘
   └─────────────────┘
                  ▲
        ┌─────────┴──────────┐
        │  Client (Angular)  │
        └────────────────────┘
```

- **Mediator maison** (pas MediatR) : `ICommand<T>`/`IQuery<T>` + handlers auto‑enregistrés par
  **Scrutor**. Les contrôleurs ne font que *dispatcher*.
- **Pas de Repository générique** : `IApplicationDbContext` injecté directement ; lectures en `AsNoTracking()`.
- **Interceptors EF** : soft‑delete (`ISoftDeletable` + filtre global) et audit (`IAuditableEntity`).
- Décisions documentées dans [`.ai/ARCHITECTURE_DECISIONS.md`](.ai/ARCHITECTURE_DECISIONS.md).

Le code est revu selon les **principes SOLID** — voir le skill [`/solid-review`](.claude/skills/solid-review/SKILL.md).

## Sécurité

- **Authentification JWT** (Bearer) + **ASP.NET Core Identity** (hachage de mot de passe, lockout
  5 tentatives / 10 min, unicité courriel + nom d'utilisateur).
- **Autorisation par rôles/politiques** : `Customer`, `Staff`, `Admin` → `StaffOrAbove`, `AdminOnly`.
  Endpoints protégés par `[Authorize]`, publics par `[AllowAnonymous]` explicite.
- **Validation centralisée** (FluentValidation via *pipeline behavior*) — jamais de `ModelState` manuel.
- **Gestion d'erreurs RFC 9457** : `GlobalExceptionHandler` mappe les exceptions en *Problem Details*.
- **Soft‑delete** (aucune suppression physique par défaut) et **audit** automatique.
- **Secrets** hors du code en production (user‑secrets / Key Vault) ; CORS restreint aux origines connues.
- **Proxy d'adresses rate‑limité** : les endpoints publics `/api/v1/places/*` sont protégés par une
  politique de limite de débit (*fixed window*, 30 requêtes / 10 s par IP → `429`).

## Proxy d'adresses (Places)

L'autocomplétion d'adresse et la résolution de code postal passent par un **proxy serveur**
(`/api/v1/places/suggest`, `/api/v1/places/lookup-postal-code`) plutôt que d'appeler un service
tiers depuis le navigateur : la clé API reste côté serveur, le débit est limité, et le fournisseur
est **interchangeable par configuration seule**.

Le port `IPlacesService` (couche Application) a trois implémentations dans l'Infrastructure ;
l'active est choisie par `Places:Provider` dans `appsettings.json` :

| Provider | `Places:Provider` | Clé requise | Notes |
|----------|-------------------|-------------|-------|
| **Photon** (défaut) | `photon` | aucune | Service public OpenStreetMap (komoot), sans clé. |
| **Radar** | `radar` | `Places:Radar:ApiKey` | Clé envoyée dans l'en‑tête `Authorization`. |
| **Google** | `google` | `Places:Google:ApiKey` | Clé envoyée en paramètre de requête `key`. |

Pour permuter de fournisseur, **aucun changement de code** : il suffit de modifier la configuration.
Exemple — passer à Radar :

```jsonc
"Places": {
  "Provider": "radar",
  "BiasLat": 45.483, "BiasLng": -75.650,        // biais géographique (Gatineau)
  "Radar": { "BaseUrl": "https://api.radar.io/", "ApiKey": "<clé Radar>" }
}
```

> En production, placez les clés (`Places:Radar:ApiKey`, `Places:Google:ApiKey`) dans
> les *user‑secrets* / Key Vault plutôt que dans `appsettings.json`.

## Accessibilité & UX

L'accessibilité est une **exigence de premier ordre** — cible **WCAG 2.2 niveau AA, 0 violation axe**.

- **Design tokens** (`shared/styles/_tokens.scss`) aux **ratios de contraste AA vérifiés**, thèmes
  **clair/sombre** explicites (`[data-theme]`) avec bascule utilisateur persistée.
- **Gestion du focus**, lien d'évitement (*skip‑link*) masqué jusqu'au focus clavier, ARIA correct,
  hiérarchie de titres, `color-scheme` sur les contrôles natifs.
- Composants accessibles réutilisables (`shared/components/a11y-components/` : modale avec piège de
  focus, accordéon, table de données, formulaire).
- **Tests d'accessibilité automatisés** : axe‑core au niveau composant (Vitest navigateur) **et**
  axe‑core sur l'app rendue (**Playwright e2e**, contraste inclus).

📄 **Artefacts professionnels** (audit & évaluations) :
[`docs/accessibility/wcag-2.2-audit.md`](docs/accessibility/wcag-2.2-audit.md) ·
[`docs/ux/heuristic-evaluation.md`](docs/ux/heuristic-evaluation.md) (heuristiques de Nielsen) ·
[`docs/ux/task-flow-analysis.md`](docs/ux/task-flow-analysis.md) (analyses de flux de tâches).

## Internationalisation

i18n Angular **compile‑time** : langue source **français**, locale **anglaise** (`/en/`). Chaînes
balisées via `i18n` (gabarits) et `$localize` (TS). Extraction : `npm run i18n:extract` → `src/locale`.

## Stratégie de tests

| Niveau | Outils | Portée |
|---|---|---|
| Unitaire backend | xUnit v3, FluentAssertions, NSubstitute | Domain, handlers, validateurs |
| Intégration backend | `WebApplicationFactory` | Endpoints API |
| Composant frontend | **Vitest (mode navigateur, Chromium réel)** + Testing Library | Composants, services |
| Accessibilité | **axe‑core** (unitaire) + **Playwright + @axe-core** (e2e) | WCAG A/AA, contraste |

Les tests d'accessibilité **échouent la CI** à la moindre violation — l'accessibilité est traitée
comme une **régression** au même titre qu'un bug fonctionnel.

## DevOps & Agile

- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) : build + tests backend, build +
  tests navigateur + e2e d'accessibilité du frontend, à chaque PR.
- **Artefacts Agile** ([`docs/agile/`](docs/agile)) : *product backlog* (user stories + critères
  d'acceptation), plan de sprints, **Definition of Ready / Done**, tableau type Azure DevOps.
- **Gabarits** d'*issues* (user story, rapport de bogue reproductible) et de PR avec checklist DoD.
- **Commits conventionnels**, branches par story — voir [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Démarrage rapide

**Prérequis** : .NET 10 SDK · Node 22 · SQL Server LocalDB · `dotnet-ef`.

```bash
# 1) Backend (API : http://localhost:5228, Scalar UI sur /scalar en Dev)
dotnet run --project src/AbrisAutoOutaouais-WebApp.API

# 2) Frontend (http://localhost:4200) — dans un autre terminal
cd src/AbrisAutoOutaouais-WebApp.Client
npm install
npm start
```

Au premier démarrage, le seeder crée le catalogue et un **compte admin** :
`admin@abrisauto.com` / `Admin123!` (connexion par courriel **ou** nom d'utilisateur).

```bash
# Tests
dotnet test                 # backend
npm test                    # frontend (Vitest navigateur + axe)
npm run e2e                 # accessibilité e2e (Playwright + axe)
npm run build:prod          # build de production localisé (fr + en)
```

> Le frontend pointe vers `http://localhost:5228` (profil http par défaut de `dotnet run`). Pour le
> profil https (`https://localhost:7035`), lancer `dotnet run --launch-profile https` et ajuster `environment.ts`.

## Structure du projet

```
AbrisAutoOutaouais-WebApp.slnx
├─ src/
│  ├─ …Domain/           # entités, value objects, enums, événements, exceptions
│  ├─ …Application/      # CQRS (commands/queries/handlers), DTOs, validateurs, Mediator
│  ├─ …Infrastructure/   # EF Core, Identity, JWT, interceptors, seeders, services
│  ├─ …API/              # controllers, middleware, composition root
│  └─ …Client/           # Angular 21 (features, core, shared, e2e Playwright)
├─ …UnitTest/  …IntegrationTest/   # xUnit
├─ docs/                 # accessibilité (WCAG 2.2), UX (heuristique, flux), Agile
├─ .github/              # CI + gabarits issues/PR
└─ .claude/skills/       # skill /solid-review
```

## Feuille de route

- [x] Catalogue + filtres + fiche produit · seeder
- [x] Auth (JWT, courriel/nom d'utilisateur), profil, rôles · **réinitialisation du mot de passe** de bout en bout
- [x] Accessibilité WCAG 2.2 AA + tests axe (unitaire & e2e) · thèmes clair/sombre · i18n fr/en
- [x] Panier · pages compte · **pages légales** (conditions, confidentialité, déclaration d'accessibilité)
- [x] Backend e‑commerce : commandes **persistées** · CRUD admin (produits, **réservations, locations, utilisateurs**) — _paiement en mode démo (pas de Stripe)_
- [x] Réservation d'installation (créneaux) & contrats de location de bout en bout
- [x] Aide & UX : FAQ accessible (`/installation`, `/location`) · vérif. de disponibilité username/courriel · confirmation du changement de langue
- [x] **Adresse structurée** (numéro civique / appartement / rue) + **autocomplétion accessible** (combobox APG, proxy Places Photon/Radar/Google, code postal pré‑rempli éditable) · marque/modèle d'abri à l'installation (autres marques sauf ShelterLogic)
- [ ] Outil « mesurer mon stationnement » (carte satellite + calculateur) → suggestion d'abri
- [ ] Déploiement (Vercel + Azure App Service) via GitHub Actions

## Compétences démontrées

- **Programmation & system design** — Clean Architecture, CQRS, SOLID, EF Core, Angular moderne (signals).
- **Sécurité web** — JWT/Identity, autorisation par rôles, validation, RFC 9457, soft‑delete/audit, secrets.
- **Accessibilité** — WCAG 2.2 AA, tests axe automatisés, technologies d'assistance (NVDA/VoiceOver),
  audit & remédiation documentés.
- **UX** — évaluation heuristique (Nielsen), analyses de flux de tâches, recommandations concrètes.
- **Qualité & Agile** — CI, tests à plusieurs niveaux, backlog/sprints/DoD, gabarits, commits conventionnels.
- **Internationalisation** — bilingue fr/en (compile‑time).
