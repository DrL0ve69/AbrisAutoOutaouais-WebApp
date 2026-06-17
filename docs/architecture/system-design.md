# Design système — du client à la base de données

> **Ce que c'est.** Le plan d'ensemble d'AbrisTempo Local : comment une action partie d'un **client**
> (mobile, tablette, web) traverse l'**edge**, l'**API**, les **couches Clean Architecture** et
> arrive jusqu'à la **base de données** — chaque constituant **annoté par sa couche**. Les diagrammes
> sont en **Mermaid** (rendu automatique sur GitHub). Une version **éditable** existe en parallèle :
> [`system-design.drawio`](./system-design.drawio) (ouvre-la dans [diagrams.net](https://app.diagrams.net)).
>
> Source de vérité = le code. Ce dépôt est un **monolithe modulaire** (.NET 10 / C# 14, Clean
> Architecture, **un seul** `ApplicationDbContext`, **Mediator maison**), front **Angular 21 SSR**.
> Pour le « pourquoi pas microservices », voir [`architecture-microservices.md`](../architecture-microservices.md).

---

## 1. Vue d'ensemble — déploiement & flux de bout en bout

Légende des couches : 🟦 **Client** · 🟩 **API** (contrôleurs minces) · 🟨 **Application** (CQRS /
Mediator) · 🟧 **Infrastructure** (EF, Identity, ports) · 🟫 **Domain** · ☁️ **Hébergement Azure** ·
🌐 **Services externes**.

```mermaid
flowchart TB
    subgraph clients["🟦 Clients (même app Angular 21 SSR, responsive + i18n fr « / » · en « /en/ »)"]
        mobile["📱 Mobile<br/>(navigateur)"]
        tablet["📲 Tablette"]
        web["💻 Web app"]
    end

    subgraph edge["☁️ Edge / livraison"]
        swa["Azure Static Web Apps<br/>CDN edge mondial + rendu SSR<br/>sert le bundle + statiques"]
    end

    subgraph aca["☁️ Azure Container Apps (API .NET 10, scale-to-zero)"]
        ingress["Ingress Envoy<br/>= load balancer + TLS<br/>(HTTP 8080 interne · forwarded headers, L-022)"]
        subgraph api["🟩 Couche API — contrôleurs minces"]
            ctrl["Controllers<br/>/api/v1/[controller]<br/>[Authorize] / [AllowAnonymous]"]
            gexh["GlobalExceptionHandler<br/>→ ProblemDetails RFC 9457"]
        end
        subgraph app["🟨 Couche Application — CQRS (Mediator maison)"]
            disp["Dispatcher.DispatchAsync<br/>ICommand/IQuery"]
            beh["Pipeline behaviors<br/>Validation (FluentValidation) · Logging"]
            handlers["Handlers HandleAsync<br/>(auto-enregistrés via Scrutor)"]
            ports["Ports (interfaces)<br/>IApplicationDbContext · IPlacesService<br/>IExpressAccountService · IPaymentService (futur)"]
        end
        subgraph infra["🟧 Couche Infrastructure"]
            efcore["EF Core + ApplicationDbContext<br/>(UN seul : Identity + domaine)"]
            interc["Interceptors<br/>SoftDelete · Audit"]
            identity["Identity + JWT<br/>IdentityService · IdentitySeeder"]
            adapters["Adaptateurs de ports<br/>Photon/Radar/Google · ExpressAccount"]
        end
        subgraph domain["🟫 Domain — entités, enums, IDomainEvent, invariants"]
            entities["Order · RentalContract · Booking<br/>Product · AppUser · Address (VO)"]
        end
    end

    subgraph data["☁️ Données"]
        sql[("Azure SQL Database S0<br/>AbrisTempoDb")]
    end

    subgraph ext["🌐 Services externes"]
        places["Géocodage adresse<br/>Photon (défaut) / Radar / Google"]
        tiles["Tuiles satellite Esri<br/>(carte /mesurer)"]
        pay["Fournisseur paiement<br/>(EPIC 7 — futur)"]
    end

    mobile & tablet & web -->|HTTPS| swa
    swa -->|"HttpClient → /api/v1/*"| ingress
    ingress --> ctrl
    ctrl --> disp --> beh --> handlers
    handlers --> ports
    ports -. implémentés par .-> efcore & identity & adapters
    handlers -.lèvent.-> gexh
    efcore --> interc --> sql
    entities -. mappées par .-> efcore
    adapters -->|proxy backend| places
    swa -.tuiles directes.-> tiles
    adapters -.futur.-> pay
```

**Points clés**
- Le **client unique** (mobile/tablette/web) est la **même** app Angular 21 SSR responsive ; la
  langue est décidée à la compilation (fr `/`, en `/en/`).
- L'**ingress Container Apps est déjà un load balancer** (Envoy) : TLS terminé à l'edge, HTTP interne
  sur 8080, d'où `ASPNETCORE_FORWARDEDHEADERS_ENABLED` (L-022) ; scale-to-zero + multi-réplicas.
- Le **géocodage passe par un proxy backend** (`IPlacesService`), **jamais** d'appel tiers direct du
  client. Les **tuiles Esri**, elles, sont chargées côté client par Leaflet (contenu statique public).
- **Une seule** base relationnelle (Identity **et** domaine dans le même `ApplicationDbContext`).

---

## 2. Chemin d'une requête, couche par couche

Exemple : un client passe une commande (`POST /api/v1/orders`). Même forme pour location, réservation,
catalogue, etc. — seuls le contrôleur et le handler changent.

```mermaid
sequenceDiagram
    autonumber
    participant C as 🟦 Client Angular<br/>(HttpClient + intercepteur JWT)
    participant LB as ☁️ Ingress / LB (Envoy)
    participant Ctrl as 🟩 OrdersController
    participant D as 🟨 Dispatcher
    participant V as 🟨 ValidationBehavior
    participant H as 🟨 PlaceOrderCommandHandler
    participant DB as 🟧 IApplicationDbContext (EF)
    participant SQL as ☁️ Azure SQL

    C->>LB: POST /api/v1/orders (+ Bearer JWT)
    LB->>Ctrl: requête routée (forwarded headers)
    Ctrl->>D: dispatcher.DispatchAsync(PlaceOrderCommand)
    D->>V: pipeline → valider d'abord
    alt invalide
        V-->>Ctrl: ValidationException → GlobalExceptionHandler → 400 ProblemDetails
    else valide
        V->>H: HandleAsync(command)
        H->>DB: AddAsync(order) / SaveChangesAsync
        Note over DB: SoftDelete + Audit interceptors<br/>peuplent les champs d'audit
        DB->>SQL: INSERT (transaction)
        SQL-->>DB: OK
        H-->>Ctrl: résultat (DTO)
        Ctrl-->>C: 201 Created
    end
```

> **Où vit l'authentification ?** Le **JWT** est émis par `IdentityService` en **Infrastructure** (ASP.NET
> Core Identity) ; le contrôleur applique `[Authorize]` / policies (`StaffOrAbove`, `AdminOnly`) en
> **API** ; les rôles (`Customer`/`Staff`/`Admin`) sont des constantes **Domain**. Côté client, un
> **intercepteur** ajoute le `Bearer` et `authGuard` protège les routes ; `ProfileService` met en
> cache `/auth/me` (signal) car le `AuthUser` du JWT ne porte pas l'adresse (L-003).

---

## 3. Règle des dépendances (Clean Architecture)

Les dépendances ne pointent que **vers l'intérieur**. Rien dans Domain/Application ne connaît
Infrastructure/API — l'inversion se fait par **ports** (interfaces dans Application, implémentés en
Infrastructure).

```mermaid
flowchart LR
    API["🟩 API<br/>contrôleurs, middleware, Program.cs"] --> APP
    INFRA["🟧 Infrastructure<br/>EF, Identity/JWT, adaptateurs, interceptors"] --> APP
    APP["🟨 Application<br/>CQRS, Dispatcher, behaviors, ports, DTOs"] --> DOMAIN
    INFRA -. implémente les ports de .-> APP
    DOMAIN["🟫 Domain<br/>entités, VO, enums, IDomainEvent, exceptions"]
    CLIENT["🟦 Client Angular 21"] -.HTTP /api/v1.-> API
```

---

## 4. Briques manquantes / à expliciter + plan d'attaque

Le design ci-dessus reflète l'**état réel**. Plusieurs préoccupations transverses classiques sont soit
**implicites** (déjà là mais non documentées), soit **absentes** (à ajouter). Cette table est le
**backlog d'infrastructure** (repris en EPIC 16 de la roadmap Phase 2).

| Brique | État aujourd'hui | Plan d'attaque (du moins risqué au plus lourd) |
|--------|------------------|------------------------------------------------|
| **Load balancer** | ✅ **Déjà présent** — ingress Envoy de Container Apps (TLS + répartition multi-réplicas). | Le **documenter** (fait ici). Vérifier la santé multi-réplicas : `MigrateOnStartup` prend le verrou SQL (sûr, L-022). |
| **Cache** | 🟡 Partiel — cache CDN SWA (statiques) ; cache client en signaux (`ProfileService` met `/auth/me` en cache, L-003). Pas de cache HTTP/serveur sur les GET publics. | 1) En-têtes `Cache-Control`/ETag sur les GET catalogue (`/products`, `/categories`) — gain immédiat, faible risque. 2) `OutputCache`/`ResponseCache` côté API .NET. 3) Cache distribué (Redis) seulement si la charge le justifie. |
| **Cookies / session** | 🟡 Le **JWT est stocké côté client** (localStorage), pas de cookie `httpOnly`. Pas de bannière de consentement. | 1) Décider **JWT localStorage vs cookie `httpOnly` + refresh token** (spike sécurité, lié EPIC 7) — compromis XSS ⇄ CSRF. 2) Si analytics : **bannière de consentement** (RGPD / Loi 25 QC). 3) Anti-forgery si bascule cookies. |
| **Rate limiting** | 🟡 Partiel — limiteur **déjà** sur le proxy Places (C2). | Étendre aux endpoints sensibles (auth `login`/`register`, `forgot-password`) via le middleware `RateLimiter` natif .NET. |
| **CORS** | ✅ Configuré (origines SWA en prod). | Revue : restreindre aux origines exactes ; documenter dans le diagramme. |
| **Secrets** | 🟡 `Jwt:Key` + connection string en `appsettings` (dev). | Migrer vers **Azure Key Vault** + user-secrets en dev (déjà recommandé dans `CLAUDE.md`). |
| **Observabilité** | 🟡 Logs console + behaviors (Logging/Performance). Pas d'APM. | Brancher **Application Insights** (traces, métriques, exceptions) sur l'API et le SSR. |
| **Health checks** | 🟡 Sonde de démarrage du conteneur (port 8080). | Ajouter `/health` (liveness/readiness) + le câbler sur l'ingress Container Apps. |
| **WAF / DDoS** | ❌ Absent. | Optionnel pour un portfolio : Azure Front Door / WAF devant l'API si exposition publique réelle. |
| **CI/CD** | ✅ GitHub Actions (`ci.yml` build+tests+axe ; SWA auto ; backend manuel via `infra/deploy-backend.ps1`). | Câbler le **CD backend auto** quand un service principal est dispo (`AZURE_CREDENTIALS`). |

```mermaid
flowchart TB
    subgraph reco["🌐 Briques transverses (existant + à ajouter)"]
        direction LR
        existant["✅ Existe<br/>LB ingress · CDN SWA · CORS<br/>rate-limit Places · CI"]
        partiel["🟡 À renforcer<br/>cache HTTP · secrets Key Vault<br/>observabilité · health checks · cookies"]
        absent["❌ À ajouter<br/>WAF/DDoS · cache distribué<br/>consentement cookies"]
    end
    existant --> partiel --> absent
```

---

## 5. Inventaire des constituants par couche (référence rapide)

| Couche | Constituants (exemples réels) |
|--------|-------------------------------|
| 🟦 **Client** | Angular 21 SSR, standalone components, signals, `AuthService`/`ProfileService`, intercepteur JWT, `authGuard`, Leaflet/geoman (carte `@defer`), three.js (viewer 3D `@defer`). |
| 🟩 **API** | `*Controller` (`/api/v1/*`), policies `StaffOrAbove`/`AdminOnly`, `GlobalExceptionHandler` (RFC 9457), middleware, `Program.cs` (composition root). |
| 🟨 **Application** | `Dispatcher` (Mediator maison), `ICommand`/`IQuery`/handlers `HandleAsync`, `ValidationBehavior` + validators FluentValidation, DTOs, **ports** `IApplicationDbContext`/`IPlacesService`/`IExpressAccountService`. |
| 🟧 **Infrastructure** | `ApplicationDbContext` (**unique**), `IEntityTypeConfiguration<T>`, `SoftDeleteInterceptor`/`AuditInterceptor`, Identity + JWT (`IdentityService`, `IdentitySeeder`), adaptateurs Places (Photon/Radar/Google), `ExpressAccountService`. |
| 🟫 **Domain** | Entités (`Order`, `RentalContract`, `Booking`, `Product`, `AppUser`), VO `Address`, enums de statut, `IDomainEvent`, exceptions (`NotFoundException`…), `Roles`, `GeoDistance`. |
| ☁️ **Hébergement** | Azure Static Web Apps (front), Azure Container Apps (API, ingress Envoy), Azure SQL S0, ACR (image), identité managée user-assigned (provisionné par Terraform `infra/`). |

> **Maintenance.** Quand l'architecture change (nouvelle brique, nouveau port, nouveau service Azure),
> mettre à jour **ce fichier** ET le `.drawio` jumeau, et croiser avec
> [`infra-terraform.md`](../infra-terraform.md) / [`deployment.md`](../deployment.md).
