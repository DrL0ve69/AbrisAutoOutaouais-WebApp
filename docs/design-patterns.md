# Patrons de conception (GoF) dans AbrisTempo Local

> **Ce que c'est.** Un catalogue des **23 patrons de conception** du « Gang of Four » (GoF), **ancré
> au code réel de ce dépôt**. Pour chaque patron : son intention en une phrase, *où il vit dans le
> code* (ou « pas utilisé — il conviendrait pour… »), et un croquis quand c'est utile.
>
> Le fil rouge du document — et la règle de l'équipe — est **« code le patron toi-même quand il est
> simple, n'ajoute une dépendance que quand elle se justifie »**. L'exemple phare est le remplacement
> de **MediatR** par un **Dispatcher maison** (§ *Mediator*, étude de cas détaillée en fin de doc).
>
> Voir aussi : `.claude/rules/design-patterns.md` (la règle opérationnelle, auto-injectée aux agents)
> et `.claude/skills/design-patterns/` (le skill pour vérifier/implémenter un patron).

---

## 0. Philosophie : coder le patron vs. ajouter une dépendance

Un patron de conception est une **idée de structure**, pas une bibliothèque. La plupart se codent en
quelques dizaines de lignes. Ajouter un paquet NuGet/npm pour un patron simple, c'est importer une
surface d'API, des montées de version, un risque de chaîne d'approvisionnement et une boîte noire —
pour quelque chose qu'on maîtriserait mieux en l'écrivant.

**Cas d'école — MediatR → Dispatcher maison.** Le projet a d'abord utilisé MediatR (la lib de
référence pour le patron *Mediator* en .NET). En constatant qu'on n'utilisait que `Send`/`Handle`,
on l'a remplacée par un `Dispatcher` de **~90 lignes** (`Application/Common/Mediator/`). Résultat :
zéro dépendance, le dispatch est lisible et débogable, et on a ajouté exactement ce qu'on voulait
(double signature `Send`/`DispatchAsync`, validation intégrée) sans plier l'API de quelqu'un d'autre.

### La règle de décision (à appliquer avant tout `dotnet add package` / `npm i`)

| Code-le toi-même quand… | Garde/ajoute une dépendance quand… |
|---|---|
| Le patron est **structurel et simple** (Mediator, Strategy, Decorator, Observer, Factory, State). | Le problème est **vaste, transversal et durci par l'usage** : ORM (EF Core), sérialisation, crypto/JWT, parsing. **Ne réécris jamais** ça. |
| Tu n'utiliserais qu'**une fraction** de la lib (cas MediatR). | Tu utiliserais **la majorité** de ses capacités et son écosystème (FluentValidation : règles, messages localisés, validation async testée). |
| Le coût d'écriture < coût d'apprentissage + maintenance de la lib. | La correction est **subtile et critique** (parsing de dates, fuseaux, sécurité) — l'erreur maison coûte plus cher que la dépendance. |
| Tu veux **maîtriser** le comportement et le faire évoluer. | C'est un **standard d'interop** où diverger nuit (HTTP, OpenAPI, RFC 9457 ProblemDetails). |

> Ce dépôt **assume ce mélange** : Mediator **maison** (simple, central, on le veut nôtre), mais on
> **garde** `FluentValidation` (validation riche + localisée), `Scrutor` (une ligne de scan
> d'assembly), EF Core, et l'Identity/JWT d'ASP.NET. Hand-roller FluentValidation ou un ORM serait
> du zèle contre-productif. **Le jugement, c'est le patron ; pas le dogme « zéro dépendance ».**

---

## 1. Patrons créationnels (comment on crée les objets)

### Factory Method — délègue la création, encapsule les invariants
**Intention.** Créer un objet via une méthode dédiée plutôt qu'un constructeur public, pour garantir
les invariants au point de création.
**Dans le dépôt.** Les **méthodes-fabriques de domaine** : `Order.Create(...)`,
`Money.Of(amount, currency)`, `Address.Create(...)`, `PhoneNumber` — constructeurs privés/`init` +
une fabrique statique qui **valide avant de retourner** (un `Money` négatif ou une `Order` en
livraison sans adresse lèvent une `BusinessRuleException`).
**Réf.** `Domain/Entities/Order.cs`, `Domain/ValueObjects/{Money,Address,PhoneNumber}.cs`.

### Abstract Factory — une famille d'objets liés derrière une interface
**Intention.** Produire des familles d'objets cohérents sans coupler le client aux classes concrètes.
**Dans le dépôt.** `IHttpClientFactory` (framework) crée les `HttpClient` typés des adaptateurs
Places. **Pas de fabrique abstraite maison** — elle conviendrait si on devait produire, par région,
une *famille* cohérente (calculateur de taxes + transporteur + format d'adresse) sélectionnée d'un bloc.

### Builder — construit un objet complexe étape par étape
**Intention.** Séparer la construction d'un objet complexe de sa représentation finale.
**Dans le dépôt.**
- **Front** — `shared/components/shelter-3d-viewer/shelter-model.builder.ts` :
  `buildShelterDescriptor(dims, options)` assemble un descripteur géométrique 3D (arcs, pannes,
  toile, bornes) pièce par pièce, **fonction pure** sans dépendance à three.js (bundle propre).
- **Back** — l'API *fluent* `EntityTypeBuilder` dans chaque `IEntityTypeConfiguration<T>`
  (`builder.Property(...).HasMaxLength(...).IsRequired()`) est un Builder fourni par EF Core.
**Réf.** `shared/components/shelter-3d-viewer/shelter-model.builder.ts`,
`Infrastructure/Persistence/Configurations/*.cs`.

### Prototype — crée par copie d'une instance existante
**Intention.** Cloner un objet plutôt que de le reconstruire.
**Dans le dépôt.** Les **`record` C#** (DTOs, commandes, value objects) avec l'expression `with` :
`profil with { Province = "QC" }` produit une copie immuable modifiée — du Prototype natif au langage.
Idem côté TS avec le *spread* `{ ...suggestion, province: 'QC' }`.
**Réf.** tous les `sealed record` de `Application/**/*.cs`.

### Singleton — une seule instance, partagée
**Intention.** Garantir une instance unique et un point d'accès global.
**Dans le dépôt.** **Pas** le Singleton « classique » (instance statique + constructeur privé — un
anti-patron pour la testabilité). À la place, le **cycle de vie singleton géré par le conteneur DI** :
`services.AddSingleton<IClientUrlProvider>(...)`, `DateTimeProvider`, `SoftDeleteInterceptor`. Côté
Angular, `@Injectable({ providedIn: 'root' })` (AuthService, CartService, MotionService, LocaleService).
**Pourquoi c'est mieux.** L'unicité est une **décision de configuration**, pas un câblage en dur :
testable (on injecte un faux), substituable, sans état global caché.
**Réf.** `Infrastructure/DependencyInjection.cs` (lignes ~107/130), `core/services/*.ts`.

---

## 2. Patrons structurels (comment on assemble classes et objets)

### Adapter — fait collaborer des interfaces incompatibles  ⭐ exemple fort
**Intention.** Convertir l'interface d'un service tiers vers celle qu'attend notre application.
**Dans le dépôt.** `IPlacesService` (port de l'Application) a **trois adaptateurs** qui enveloppent
trois API de géocodage incompatibles : `PhotonPlacesService` (OpenStreetMap, défaut, sans clé),
`RadarPlacesService`, `GooglePlacesService`. Chacun **traduit** la réponse maison vers le **format
canonique** — notamment la province en **code 2 lettres** (Photon renvoie « Québec » → normalisé en
« QC » par `CanadianProvinceCodes`, cf. leçon L-011).
**Réf.** `Application/Common/Interfaces/IPlacesService.cs`,
`Infrastructure/Services/Places/{Photon,Radar,Google}PlacesService.cs` + `CanadianProvinceCodes.cs`.

### Bridge — découple une abstraction de son implémentation
**Intention.** Faire varier indépendamment une abstraction et son implémentation.
**Dans le dépôt.** L'axe `IPlacesService` (abstraction stable, utilisée par les handlers) vs. les
adaptateurs (implémentations interchangeables) **tend** vers le Bridge. La distinction avec Adapter
est fine : ici l'intention est surtout d'*unifier des API tierces* (Adapter) ; ça deviendrait un
Bridge pur si l'abstraction *et* l'implémentation évoluaient sur deux axes orthogonaux (p. ex.
`Notification` × `Canal` = email/SMS/push).

### Composite — compose des objets en arborescence (tout/partie)
**Intention.** Traiter uniformément un objet simple et une composition d'objets.
**Dans le dépôt.** La **composition de validateurs** : un `CreateBookingCommandValidator` compose un
`AddressDtoValidator` via `RuleFor(x => x.Address).SetValidator(new AddressDtoValidator())` — l'arbre
de règles se valide d'un seul `ValidateAsync`. L'**arbre de composants Angular** (un composant parent
qui projette des enfants via `<ng-content>`, cf. `app-address-choice`) est l'autre Composite naturel.
**Réf.** `Application/Bookings/Commands/CreateBooking/CreateBookingCommandValidator.cs`,
`Application/Common/Validators/AddressDtoValidator.cs`.

### Decorator — ajoute un comportement sans modifier l'objet  ⭐ exemple fort
**Intention.** Envelopper un objet pour lui ajouter une responsabilité, de façon transparente.
**Dans le dépôt.** Trois decorators, un par couche :
- **`ValidationBehavior<TRequest,TResponse>`** enveloppe un handler : il valide, puis appelle
  `next()` (le handler décoré). Signature `Handle(request, Func<ValueTask<TResponse>> next, ct)`.
- **Intercepteurs EF** (`AuditInterceptor`, `SoftDeleteInterceptor`) décorent `SaveChangesAsync`
  pour remplir l'audit / convertir un *delete* en *soft-delete*.
- **Intercepteurs HTTP Angular** (`authInterceptor`, `errorInterceptor`) décorent chaque requête
  sortante (ajout du Bearer, gestion du 401).
**Réf.** `Application/Common/Behaviors/ValidationBehavior.cs`,
`Infrastructure/Persistence/Interceptors/*.cs`, `core/interceptors/*.ts`.

### Facade — une interface simplifiée sur un sous-système complexe
**Intention.** Offrir un point d'entrée unique et simple à un ensemble compliqué.
**Dans le dépôt.** `IDispatcher`/`Dispatcher` est une **façade** : le contrôleur fait
`dispatcher.DispatchAsync(command)` et ignore la résolution du handler, la réflexion générique et la
validation. Les **contrôleurs minces** sont eux-mêmes une façade HTTP sur l'Application. `ProfileService`
(front) masque `/auth/me` + cache derrière un signal.
**Réf.** `Application/Common/Mediator/Dispatcher.cs`, `API/Controllers/*.cs`, `core/services/profile.service.ts`.

### Flyweight — partage l'état commun pour économiser la mémoire
**Intention.** Réutiliser des objets immuables partagés plutôt que d'en multiplier les copies.
**Dans le dépôt.** **Pas utilisé explicitement.** Il conviendrait pour une table de correspondance
immuable consultée souvent — par ex. `CanadianProvinceCodes` exposé comme dictionnaire statique
partagé est un Flyweight de fait. L'*identity map* du change-tracker d'EF en est un cousin (une
entité = une instance par contexte).

### Proxy — un substitut qui contrôle l'accès à un autre objet  ⭐ exemple fort
**Intention.** Intercaler un intermédiaire pour contrôler/transformer l'accès à une ressource.
**Dans le dépôt.** L'**endpoint Places de notre API est un Proxy** vers les géocodeurs tiers : le
client n'appelle **jamais** Photon/Radar/Google directement — il appelle notre API, qui relaie,
**cache la clé**, normalise le format et contrôle l'accès (proxy de protection). Côté Angular,
`PlacesService` est un *remote proxy* (l'objet local représente une ressource distante).
**Réf.** `core/services/places.service.ts` → API → `Infrastructure/Services/Places/*`.

---

## 3. Patrons comportementaux (comment les objets communiquent)

### Mediator — centralise la communication entre objets  ⭐⭐ étude de cas (voir § final)
**Intention.** Éviter que des objets se référencent directement ; ils passent par un médiateur.
**Dans le dépôt.** Le `Dispatcher` maison : les contrôleurs ne connaissent **aucun** handler ; ils
envoient une commande/query au dispatcher, qui résout et invoque le bon handler.
**Réf.** `Application/Common/Mediator/` — **détaillé en fin de document.**

### Chain of Responsibility — passe la requête le long d'une chaîne de gestionnaires
**Intention.** Découpler l'émetteur d'une requête de ses traitements successifs.
**Dans le dépôt.** Le **délégué `next()`** des pipeline behaviors enchaîne validation → handler
(chaque maillon décide de passer la main). Le **pipeline de middlewares ASP.NET** (dont
`GlobalExceptionHandler`) est la CoR canonique : chaque middleware traite ou délègue au suivant.
**Réf.** `Application/Common/Behaviors/ValidationBehavior.cs` (`next`),
`API/Middlewares/GlobalExceptionHandler.cs`.

### Command — encapsule une requête en objet  ⭐ exemple fort
**Intention.** Réifier une requête (paramétrer, mettre en file, journaliser, rejouer).
**Dans le dépôt.** Le cœur du **CQRS** : `ICommand<TResult>` / `IQuery<TResult>`. Chaque cas d'usage
est un objet-commande immuable (`PlaceOrderCommand`, `CreateBookingCommand`, `RescheduleBookingCommand`)
avec **un** handler. C'est *Command* (l'objet-requête) + *Mediator* (le dispatch) combinés.
**Réf.** `Application/Common/Mediator/ICommand.cs`, `Application/**/Commands/**`.

### Interpreter — une grammaire et son interprète
**Intention.** Représenter une grammaire et l'évaluer.
**Dans le dépôt.** **Pas de grammaire maison** (rare en applicatif). Les **arbres d'expression LINQ**
interprétés par EF Core (`Where(x => !x.IsDeleted)`, `HasQueryFilter`) et les expressions de règles
FluentValidation en sont la forme fournie par le framework.
**Réf.** filtres globaux dans `Infrastructure/Persistence/Configurations/*.cs`.

### Iterator — parcourt une collection sans exposer sa structure
**Intention.** Accéder séquentiellement aux éléments d'un agrégat.
**Dans le dépôt.** Omniprésent et **idiomatique** : `IEnumerable<T>`/`IReadOnlyList<T>` en types de
retour, `foreach`, `yield`, LINQ. C'est le patron qu'on « consomme » sans le coder (le langage le
fournit) — d'où la convention « retourner `IEnumerable<T>`/`IReadOnlyList<T>` ».

### Mediator → *(voir ci-dessus)*

### Memento — capture/restaure un état sans violer l'encapsulation
**Intention.** Sauvegarder un état pour pouvoir y revenir (annulation).
**Dans le dépôt.** Pas de Memento d'annulation classique. Le **soft-delete** (`ISoftDeletable` +
`SoftDeleteInterceptor` : `IsDeleted`/`DeletedAt`, restaurable via `.IgnoreQueryFilters()`) en est un
cousin pragmatique — l'état d'avant-suppression est préservé et récupérable.
**Réf.** `Domain/Interfaces/ISoftDeletable.cs`, `Infrastructure/Persistence/Interceptors/SoftDeleteInterceptor.cs`.

### Observer — notifie automatiquement des abonnés d'un changement  ⭐ exemple fort
**Intention.** Définir une dépendance 1→N : quand un sujet change, ses observateurs réagissent.
**Dans le dépôt.** Trois incarnations :
- **Événements de domaine** : `IDomainEvent` + `OrderPlacedEvent`, `BookingConfirmedEvent`,
  `RentalCreatedEvent` (le domaine *publie*, des handlers *réagissent*).
- **Signals/`computed` Angular** : `isAuthenticated = computed(() => !!_token())` se recalcule quand
  le sujet change — Observer réactif intégré.
- **RxJS `Observable`** (PlacesService, AuthService) et **SignalR** (push temps réel).
**Réf.** `Domain/Events/*.cs`, `core/services/auth.service.ts` (signals), `core/services/places.service.ts`.

### State — change de comportement selon un état interne
**Intention.** Un objet modifie son comportement quand son état change.
**Dans le dépôt.** **Forme légère** : les enums `BookingStatus` (Pending→Confirmed→Completed/Cancelled),
`OrderStatus`, `RentalStatus` + des **gardes de transition** dans les handlers (on refuse une
transition invalide). On n'a **pas** matérialisé chaque état en classe (le State « pur ») car les
transitions sont peu nombreuses et localisées — un enum + gardes reste plus lisible ici. *Bascule
vers le State à classes* si les règles par état se multiplient et se dispersent.
**Réf.** `Domain/Enums/{BookingStatus,OrderStatus,RentalStatus}.cs`, handlers
`Application/Bookings/Commands/**`.

### Strategy — algorithmes interchangeables à l'exécution  ⭐ exemple fort
**Intention.** Encapsuler une famille d'algorithmes et les rendre permutables.
**Dans le dépôt.** Le **choix du fournisseur Places par configuration** : `switch (Places:Provider)`
en DI sélectionne Photon/Radar/Google **sans toucher au code** appelant. Les **politiques
d'autorisation** (`StaffOrAbove`, `AdminOnly`) et les **validateurs** (une stratégie de validation par
commande) sont d'autres stratégies. *(Places est à la fois Adapter — unifier les API — et Strategy —
choisir à l'exécution.)*
**Réf.** `Infrastructure/DependencyInjection.cs` (lignes ~139-153 le `switch`, ~97-98 les policies).

### Template Method — squelette d'algorithme, étapes redéfinissables
**Intention.** Fixer le squelette d'un algorithme dans une base, déléguer des étapes aux sous-classes.
**Dans le dépôt.** Les **intercepteurs EF** héritent de `SaveChangesInterceptor` et **redéfinissent**
les points d'extension (`SavingChangesAsync`) — le « quand » est fixé par EF, le « quoi » par nos
overrides (`AuditInterceptor`, `SoftDeleteInterceptor`). Le `ValidationBehavior` fixe aussi le
squelette « valider → `next()` ».
**Réf.** `Infrastructure/Persistence/Interceptors/*.cs`.

### Visitor — sépare un algorithme des objets qu'il parcourt
**Intention.** Ajouter des opérations à une structure d'objets sans modifier leurs classes.
**Dans le dépôt.** **Pas utilisé en applicatif** (l'`ExpressionVisitor` d'EF est interne au
framework). Il conviendrait pour parcourir l'arbre géométrique du `ShelterDescriptor` afin d'en
dériver plusieurs sorties (rendu 3D, devis matériaux, export DXF) sans alourdir le descripteur.

---

## 4. Récapitulatif — où chaque patron vit dans le dépôt

| Patron | Présent | Ancrage principal |
|---|:---:|---|
| **Créationnels** | | |
| Factory Method | ✅ | `Order.Create`, `Money.Of`, `Address.Create` |
| Abstract Factory | ◑ | `IHttpClientFactory` (framework) ; maison : non |
| Builder | ✅ | `shelter-model.builder.ts`, `EntityTypeBuilder` (EF) |
| Prototype | ✅ | `record … with { }`, spread TS |
| Singleton | ✅ | DI `AddSingleton`, `providedIn: 'root'` |
| **Structurels** | | |
| Adapter | ✅ | `IPlacesService` + Photon/Radar/Google |
| Bridge | ◑ | axe Places (tend vers Bridge) |
| Composite | ✅ | validateurs composés, arbre de composants |
| Decorator | ✅ | `ValidationBehavior`, intercepteurs EF & HTTP |
| Facade | ✅ | `Dispatcher`, contrôleurs minces, `ProfileService` |
| Flyweight | ◯ | non explicite (candidat : `CanadianProvinceCodes`) |
| Proxy | ✅ | endpoint Places (proxy géocodeur), `PlacesService` |
| **Comportementaux** | | |
| Mediator | ✅ | `Dispatcher` maison ⭐ |
| Chain of Responsibility | ✅ | `next()` des behaviors, middlewares ASP.NET |
| Command | ✅ | `ICommand<T>` / handlers CQRS |
| Interpreter | ◑ | LINQ/EF (framework) |
| Iterator | ✅ | `IEnumerable<T>`, `foreach`, LINQ |
| Memento | ◑ | soft-delete (cousin) |
| Observer | ✅ | domain events, signals, RxJS, SignalR |
| State | ✅ | enums de statut + gardes (forme légère) |
| Strategy | ✅ | `switch (Places:Provider)`, policies, validateurs |
| Template Method | ✅ | intercepteurs EF (override des hooks) |
| Visitor | ◯ | non (candidat : `ShelterDescriptor`) |

Légende : ✅ présent · ◑ présent sous forme framework / partielle · ◯ absent (candidat noté).

---

## 5. Étude de cas — remplacer MediatR par un Mediator maison

C'est l'illustration concrète et utile demandée : *comment* on a hand-rollé le patron Mediator, et
comment t'en servir.

### 5.1 Le problème que résout le Mediator
Sans médiateur, un contrôleur connaîtrait chaque service métier et les câblerait à la main (couplage
fort, contrôleurs gros, tests difficiles). Le Mediator interpose **un seul point** : le contrôleur
envoie un **message** (commande/query) ; le médiateur trouve et exécute **le** handler. Le contrôleur
ne connaît ni le handler, ni ses dépendances.

### 5.2 Les pièces (toutes dans `Application/Common/Mediator/`)

```csharp
// ICommand.cs — un message qui mute l'état et renvoie TResult
public interface ICommand<TResult> { }
public interface ICommand : ICommand<Unit> { }      // commande sans valeur de retour (Unit = « void »)

// IQuery.cs — un message en lecture seule
public interface IQuery<TResult> { }

// ICommandHandler.cs — le gestionnaire d'UNE commande
public interface ICommandHandler<TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    ValueTask<TResult> Handle(TCommand command, CancellationToken ct);
}

// IDispatcher.cs — la façade que voient les contrôleurs
public interface IDispatcher
{
    Task<TResult> DispatchAsync<TResult>(ICommand<TResult> command, CancellationToken ct = default);
    Task<TResult> DispatchAsync<TResult>(IQuery<TResult> query, CancellationToken ct = default);
}
```

Le `Unit` (type « rien », équivalent du `void` générique) évite de dupliquer toute l'API pour les
commandes sans retour — c'est le même choix que MediatR.

### 5.3 Le cœur — `Dispatcher.cs`

```csharp
public sealed class Dispatcher(IServiceProvider sp) : IDispatcher
{
    public async Task<TResult> DispatchAsync<TResult>(ICommand<TResult> command, CancellationToken ct = default)
    {
        await ValidateAsync(command, ct);                              // 1. valide (FluentValidation) → 422 si KO

        var handlerType = typeof(ICommandHandler<,>)                   // 2. ICommandHandler<LaCommande, TResult>
            .MakeGenericType(command.GetType(), typeof(TResult));
        dynamic handler = sp.GetRequiredService(handlerType);          // 3. le conteneur fournit LE handler

        return await handler.HandleAsync((dynamic)command, ct);        // 4. on l'exécute
    }
    // surcharge IQuery quasi identique …
}
```

Les **3 idées** qui font tout marcher :
1. **Réflexion générique** — `MakeGenericType` reconstruit le type fermé du handler à partir du type
   *réel* de la commande reçue. C'est ce qui dispense de toute table de routage manuelle.
2. **Résolution par le conteneur** — `sp.GetRequiredService(handlerType)` : la DI livre le handler
   *avec ses dépendances déjà injectées* (DbContext, services…).
3. **`dynamic`** — contourne le fait que `TCommand` n'est pas connu statiquement ici, pour appeler
   `Handle`/`HandleAsync` sans une cascade de génériques. C'est le compromis assumé du Mediator maison.

> **Note de fidélité (drift réel).** L'interface `ICommandHandler` déclare `Handle(...)` qui renvoie
> un `ValueTask`, mais `DispatchAsync` appelle dynamiquement `HandleAsync(...)` (`Task`). Les handlers
> du dépôt exposent donc bien un `HandleAsync` — c'est ce que `dynamic` permet, et ce que `CLAUDE.md`
> documente (« controllers call `DispatchAsync`; handlers implement `HandleAsync` »). À l'ajout d'un
> handler, **suis le voisin** : copie la forme exacte des handlers existants du même dossier.

### 5.4 L'enregistrement automatique (Scrutor — la dépendance qu'on a *gardée*)

```csharp
// Infrastructure/DependencyInjection.cs
services.Scan(scan => scan
    .FromAssemblies(typeof(AssemblyMarker).Assembly)
    .AddClasses(c => c.AssignableTo(typeof(ICommandHandler<,>)))
        .AsImplementedInterfaces().WithScopedLifetime()
    .AddClasses(c => c.AssignableTo(typeof(IQueryHandler<,>)))
        .AsImplementedInterfaces().WithScopedLifetime());
```

On a hand-rollé le *dispatch* (l'idée du patron) mais gardé **Scrutor** pour le *scan d'assembly* :
une ligne, robuste, qui s'écrirait sinon à coups de réflexion fragile. Application directe de la règle
§0 : code le patron, garde l'outil transversal éprouvé.

### 5.5 Bout en bout — le contrôleur ne voit que le message

```csharp
[HttpPost]
public async Task<IActionResult> PlaceOrder(PlaceOrderCommand command, CancellationToken ct)
    => Ok(await dispatcher.DispatchAsync(command, ct));   // ni handler, ni service métier connus ici
```

### 5.6 Recette — ajouter un nouveau cas d'usage
1. **Commande/Query** : `sealed record XxxCommand(...) : ICommand<XxxResult>` dans
   `Application/<Feature>/Commands/Xxx/`.
2. **Validateur** *(optionnel)* : `XxxCommandValidator : AbstractValidator<XxxCommand>`, **dans le
   même dossier** (la validation passe automatiquement avant le handler).
3. **Handler** : `XxxCommandHandler : ICommandHandler<XxxCommand, XxxResult>` ; copie la forme
   `HandleAsync` d'un handler voisin. Scrutor l'enregistre tout seul.
4. **Contrôleur** : un `dispatcher.DispatchAsync(command, ct)`. **Rien d'autre à câbler.**

C'est exactement le bénéfice du patron : ajouter un cas d'usage = ajouter des fichiers, **jamais
modifier** le dispatcher ni le contrôleur (Open/Closed).

---

*Sources : le code de ce dépôt (cité ci-dessus) et le catalogue GoF « Design Patterns: Elements of
Reusable Object-Oriented Software » (Gamma, Helm, Johnson, Vlissides, 1994). Toute classe/fichier
mentionné doit être recoupé avec la source — le code fait foi (cf. `CLAUDE.md`).*
