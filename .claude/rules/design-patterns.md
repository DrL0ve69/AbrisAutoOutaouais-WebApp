# Patrons de conception — règle opérationnelle (AbrisTempo Local)

> **Ce que c'est.** Une règle courte à appliquer **en écrivant** ou **en révisant** du code backend
> (et frontend quand c'est pertinent) : *quel patron utiliser, et surtout coder le patron soi-même
> plutôt qu'ajouter une dépendance quand c'est simple*. Le hook `PostToolUse`
> (`post-edit-guardrail.mjs`) pointe ici sur toute édition `.cs`. Le catalogue complet des 23 patrons
> GoF **ancré au code réel** est dans `docs/design-patterns.md` ; le skill `design-patterns` sert à
> vérifier/implémenter un patron à la demande.
>
> **Règle d'or :** *code le patron toi-même quand il est simple ; n'ajoute une dépendance que quand
> elle se justifie.* L'exemple fondateur est **MediatR remplacé par le `Dispatcher` maison**
> (`Application/Common/Mediator/`).

---

## 1 · Avant tout `dotnet add package` / `npm i` — la décision

**Code-le toi-même** si le patron est structurel et simple (Mediator, Strategy, Decorator, Observer,
Factory, State), si tu n'utiliserais qu'une fraction de la lib, ou si tu veux maîtriser et faire
évoluer le comportement.

**Garde / ajoute une dépendance** si le problème est vaste et durci par l'usage (ORM, sérialisation,
crypto/JWT, parsing de dates), si tu utiliserais la majorité de ses capacités, ou si c'est un
standard d'interop (HTTP, RFC 9457).

> Ce dépôt **assume le mélange** : Mediator **maison**, mais on **garde** FluentValidation, Scrutor,
> EF Core, Identity/JWT. **Ne réécris jamais** un ORM, du crypto ou un parseur de dates. Le but n'est
> pas « zéro dépendance » — c'est *ne pas importer une boîte noire pour 30 lignes de patron*.

- [ ] Une nouvelle dépendance est proposée → justifie-la avec la grille ci-dessus **dans le diff/PR**.
      Si le patron tient en quelques dizaines de lignes et qu'on n'en utiliserait qu'une fraction,
      **hand-roll** (cf. la décision MediatR).
- [ ] Tu réimplémentes quelque chose de critique-et-subtil (dates, fuseaux, sécurité, sérialisation) →
      **stop**, garde la lib éprouvée.

---

## 2 · Réutilise l'idiome déjà présent — n'invente pas un 2ᵉ mécanisme

Avant d'introduire une nouvelle structure, **vérifie si le dépôt a déjà le patron** et copie sa forme
(cohérence > nouveauté). Cartographie complète dans `docs/design-patterns.md` ; les ancrages clés :

| Besoin | Patron | Idiome du dépôt à réutiliser |
|---|---|---|
| Nouveau cas d'usage (mutation/lecture) | **Command + Mediator** | `sealed record XxxCommand : ICommand<T>` + handler `HandleAsync` (Scrutor enregistre) ; le contrôleur ne fait que `dispatcher.DispatchAsync(...)`. |
| Préoccupation transversale (valider/auditer/journaliser) | **Decorator / Chain** | un *pipeline behavior* (`ValidationBehavior`, `next()`) ou un intercepteur EF/HTTP — **pas** de logique dans le contrôleur. |
| Service tiers à intégrer | **Adapter (+ Strategy)** | un port `Ixxx` dans Application + un adaptateur par fournisseur dans Infrastructure ; sélection par **config** en DI (cf. `IPlacesService` Photon/Radar/Google). |
| Algo permutable à l'exécution | **Strategy** | `switch` en DI sur une clé de config, ou policies d'autorisation — jamais un `if/else` qui grossit (OCP). |
| Réagir à un fait métier | **Observer** | `IDomainEvent` côté back ; `signal`/`computed`/RxJS côté front. |
| Créer avec invariants | **Factory Method** | méthode-fabrique de domaine (`Order.Create`, `Money.Of`) — constructeur privé + validation. |
| Statut avec transitions | **State (léger)** | enum de statut + gardes de transition dans le handler ; passe au State à classes seulement si les règles par état se dispersent. |
| Unicité d'un service | **Singleton via DI** | `AddSingleton` / `providedIn: 'root'` — **jamais** d'instance statique + constructeur privé (anti-testabilité). |

---

## 3 · Anti-patrons à refuser en revue

- [ ] **`if/else` ou `switch` sur un type/enum qui grossit** à chaque nouveau cas → Strategy /
      polymorphisme / registre (OCP). (Exception légitime : le `switch` de sélection de provider en
      DI, qui *est* la Strategy.)
- [ ] **Logique métier dans le contrôleur** (validation manuelle, `try/catch`, `new` d'un service) →
      ça appartient à un handler / behavior / au `GlobalExceptionHandler` (Facade + Chain).
- [ ] **Application qui référence Infrastructure**, ou un service `new`-é au lieu d'être injecté →
      viole DIP ; dépends d'une abstraction (cf. `solid-review`).
- [ ] **Singleton classique** (instance statique mutable) → cycle de vie géré par le conteneur.
- [ ] **Nouvelle dépendance pour un patron simple** sans justification dans le PR → hand-roll
      (souviens-toi de MediatR → `Dispatcher`).
- [ ] **Un 2ᵉ mécanisme** pour un besoin déjà couvert (un bus d'événements maison alors que `IDomainEvent`
      existe, un nouveau dispatch parallèle au `Dispatcher`) → réutilise l'idiome en place.

---

## 4 · Vérif (le patron ne suffit pas — il faut que ça marche)

- [ ] Backend touché → `dotnet test` + un passage `solid-review` sur le diff (SRP/OCP/LSP/ISP/DIP :
      un patron mal posé est d'abord une violation SOLID).
- [ ] Nouveau handler/commande → il est **auto-enregistré** (Scrutor) : pas d'enregistrement manuel ;
      le contrôleur ne câble rien d'autre que `DispatchAsync`. Ajoute le test du handler.
- [ ] Nouvel adaptateur d'un port existant → il émet le **format canonique** que le validateur attend
      (cf. L-011 : province en code 2 lettres) ; le test double imite le **fournisseur par défaut**.
- [ ] Frontend → `npm run build` + `npm test` ; suis le skill `angular` + l'idiome signals/inject().

---

**Pré-commit, sur un diff qui introduit/retouche une structure :** la dépendance est-elle justifiée
(§1) ? l'idiome existant est-il réutilisé (§2) ? aucun anti-patron (§3) ? `dotnet test` + `solid-review`
verts (§4) ? Le catalogue raisonné et l'étude de cas Mediator sont dans `docs/design-patterns.md`.
