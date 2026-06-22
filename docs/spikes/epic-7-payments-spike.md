# Spike EPIC 7 — Paiements en ligne : comment encaisser « zéro frais / sans clé » dans une archi .NET Clean/CQRS ?

> **Livrable préalable à EPIC 7** (spike de recherche dédié, exigé par la roadmap — `ROADMAP-PHASE-2.md` ligne 53 « *spike de recherche d'abord* », ligne 127 « *dont un spike de recherche dédié au préalable* »). **But :** comparer les modèles de paiement alignés Québec/Ottawa (Interac) aux **meilleures pratiques** et à la **contrainte budgétaire dure** du projet, puis **recommander** une approche **avant** d'écrire la moindre ligne (US-7.1 / US-7.2 / US-7.3). Ce document éclaire la décision, il ne la verrouille pas.
>
> **Épopée :** EPIC 7 — Paiements en ligne (Interac e-Transfer + cartes). **Date :** 2026-06-22. **Auteur :** boucle d'agents (architecte / recherche). **Statut :** 🟡 **SPIKE — non engagé, aucun code.** Les US-7.x sont **MoSCoW « Could »** ; rien n'est implémenté tant que l'utilisateur n'a pas tranché les « Décisions à prendre » (§7).

---

## 1 · Question du spike

Comment offrir un **paiement aligné Québec / Ottawa** (clientèle Desjardins/banques canadiennes, rail **Interac**), **conforme à la règle budget « zéro frais / sans clé »** (`.claude/rules/budget-free-tier.md`), **dans l'architecture réelle du dépôt** (.NET 10 / C# 14, Clean Architecture, **Mediator maison**, port/adaptateur sélectionné par config comme `IPlacesService`) — **sans** retomber dans les extraits **Node/Express** du `.docx` qui ne s'appliquent pas à ce dépôt ?

> **Divergence roadmap ↔ réalité, déjà signalée.** Le `.docx` source (recherche paiements) **suppose un backend Node.js/Express** et fournit du code Express. Le dépôt est **.NET/Clean Architecture/Mediator maison** (`ROADMAP-PHASE-2.md` lignes 22-28). **Aucun extrait Express ne s'applique tel quel.** Toute intégration suit l'idiome `IPlacesService` (port Application + adaptateur Infrastructure + sélection par config en DI).

---

## 2 · Contrainte cardinale (non négociable)

La règle `.claude/rules/budget-free-tier.md` est **dure** : *jamais de dépense, d'abonnement, de clé API facturée ni de service payant sans le consentement explicite du propriétaire ; par défaut on choisit du **gratuit ET sans clé**.* Un « tier gratuit » qui **exige un compte de facturation / une carte de crédit**, ou qui peut **facturer au dépassement**, est **traité comme PAYANT → REJETÉ**. Seule ressource payée déjà acquise : ~120 $ CA de crédit étudiant Azure (non destiné aux frais de transaction).

Deux faits techniques verrouillent le problème (confirmés en recherche 2026, cf. §3) :

1. **Interac est un réseau interbancaire fermé canadien.** Aucun logiciel open-source ne peut parler **directement** à Desjardins/RBC/TD : toute intégration Interac **directe** passe **obligatoirement par un intermédiaire canadien réglementé** (VoPay, Paysafe, Payment Source…) — **tous sous contrat payant** avec onboarding/compte de facturation. Le « gratuit » d'un orchestrateur (Hyperswitch) concerne l'**aiguillage**, **jamais le mouvement d'argent**.
2. **Le seul rail Interac réellement gratuit et sans tiers est l'e-Transfer « manuel ».** Le client envoie un virement Interac à **dépôt automatique** vers le courriel du marchand, en citant une **référence de commande** ; l'admin **réconcilie** à la main (ou via une règle de dépôt). Aucune API, aucune clé, aucun frais d'intermédiaire.

> **Conséquence directe :** tout fournisseur **API** Interac (VoPay/Paysafe/Payment Source) est, **par construction**, exclu par défaut. Le seul candidat **gratuit + sans clé** est l'**e-Transfer manuel** → c'est lui qui doit être le **défaut/MVP**, exactement comme `PhotonPlacesService` (keyless) est le défaut de `IPlacesService`.

---

## 3 · Options comparées

Légende « gratuité réelle » : **🟢 gratuit + sans clé** · **🟡 gratuit mais compte (sans carte)** · **🔴 facturable / compte de facturation requis → REJETÉ par le budget**.

| Option | Rôle | Gratuité réelle (vérifiée 2026) | Clé / compte requis | Effort .NET | Risque réglementaire / Loi 25 / sécurité |
|--------|------|---------------------------------|---------------------|-------------|------------------------------------------|
| **e-Transfer manuel + dépôt auto** ⭐ **RECOMMANDÉ (MVP)** | MVP sans API : référence de commande → virement Interac du client → réconciliation admin | **🟢 Vraiment gratuit + sans clé.** Aucun tiers, aucun frais d'API, aucun contrat. | **Aucun.** Pas de secret, pas de compte marchand. | **Faible.** Génération d'une référence non devinable + un statut de paiement sur l'agrégat + une action admin « marquer payé ». Pur .NET, pas de HTTP sortant. | **Le plus faible.** **Aucune donnée bancaire ne transite ni n'est stockée** (le client paie dans **sa** banque). Pas de PCI. Loi 25 : surface minimale. Seul risque = réconciliation humaine (un humain confirme le paiement). |
| **Hyperswitch** (self-host) | Orchestrateur open-source (Apache-2.0) « façon Stripe » | **🔴 Logiciel gratuit, MAIS frais du processeur en aval inévitables** + infra à héberger. Pas de support Interac documenté ; écrit en **Rust**, déploiement **Kubernetes/Helm** orienté SaaS. | Compte chez chaque **processeur connecté** (donc compte de facturation en aval). | **Élevé/inadapté.** À intégrer en .NET via ses **API HTTP** (pas un SDK .NET) ; pèse une infra K8s hors-budget Azure. | Ne résout **pas** la contrainte Interac (il aiguille, il n'encaisse pas). Reste **PCI** dès qu'une carte passe. **Sur-dimensionné** pour un portfolio. |
| **VoPay** | API open-banking canadienne (Interac e-Transfer request/payout, plafond ~25 000 $) | **🔴 Contrat payant.** Pricing « sur devis, contactez les ventes » ; **onboarding compliance** obligatoire (donc compte de facturation). Sandbox dispo mais la **prod = contrat**. | **Clé + compte marchand réglementé.** | Moyen (API HTTP REST → adaptateur Infra). | Encaisse réellement de l'argent → **KYC/AML, contrat, frais par transaction**. **Hors-budget par défaut.** |
| **Paysafe** | Processeur canadien (Interac e-Transfer **+ cartes**) | **🔴 Contrat payant.** Pas de rate-card public ; tarif **personnalisé** (≈2,75 % + frais/transaction, illustratif) ; **compte marchand** requis. | **Clé + compte marchand.** | Moyen. | Cartes ⇒ **PCI-DSS** ; contrat ; frais. **Hors-budget par défaut.** |
| **Payment Source / Konek** | Interac Direct (redirection AccèsD Desjardins, « Interac Debit ») | **🔴 Contrat payant.** Intermédiaire réglementé, compte marchand. | **Clé + compte marchand.** | Moyen-élevé (redirection + retour signé). | Redirection bancaire ⇒ contrat + frais. **Hors-budget par défaut.** |
| **Stripe (mode test)** | Cartes (+ certains rails CA) | **🟡 Sandbox gratuit sans carte** ; **🔴 frais en prod.** | Clé de test (compte sans carte possible). | Faible-moyen (SDK .NET officiel). | **Démo seulement.** Pratique pour *montrer* un tunnel carte en portfolio sans contrat — **jamais** en prod sans accord. PCI géré par Stripe Elements/Checkout. |
| Lago / Flexprice / Polar | Facturation SaaS metering | — | — | — | **À éviter ici** (`.docx`) : conçus pour le *metering* SaaS, pas le panier/checkout e-commerce ni les rails de détail. |

> **Vérification 2026 (recherche web, §Sources) :** VoPay, Paysafe et Payment Source confirment tous un **tarif sur devis + onboarding/compte marchand** → **compte de facturation requis = traité comme PAYANT → REJETÉ** par la règle budget. Hyperswitch reste Apache-2.0 self-host mais **Rust/Kubernetes** et **ne supprime pas les frais aval**. **Aucune option API n'est gratuite-sans-carte.** Seul l'**e-Transfer manuel** satisfait la contrainte cardinale.

---

## 4 · Architecture recommandée (calquée sur `IPlacesService`)

L'idiome réel à imiter (vérifié dans le code) : un **port** `IPlacesService` dans `Application/Common/Interfaces/`, des **adaptateurs** `PhotonPlacesService` (défaut, **keyless**) / `RadarPlacesService` / `GooglePlacesService` dans `Infrastructure/Services/Places/`, une **sélection par config** (`switch` sur `Places:Provider` dans `Infrastructure/DependencyInjection.cs`, défaut Photon), et des **options** `PlacesOptions` (`ApiKey: ""` pour les stubs). **Le port paiement suit ce patron à l'identique.**

### 4.1 Port (Application)

`IPaymentService` dans `src/AbrisAutoOutaouais-WebApp.Application/Common/Interfaces/IPaymentService.cs`. Aucun type Infra ne traverse la frontière ; seuls des DTO Application et des chaînes circulent. Esquisse de contrat (à figer en US-7.3) :

- `InitiatePaymentResult InitiateAsync(paymentRef, amount, customerContact, ct)` — pour le MVP manuel, renvoie les **instructions e-Transfer** (courriel destinataire + **référence de commande** à inscrire) ; pour un futur adaptateur API, renverrait une URL/redirection ou un identifiant de transaction.
- `Task<PaymentStatus> GetStatusAsync(paymentRef, ct)` — résilient (jamais d'exception réseau → 500), comme le contrat `IPlacesService`.

### 4.2 Adaptateurs (Infrastructure, `Services/Payments/`)

- **`ManualInteracPaymentService`** — **adaptateur par défaut, keyless, gratuit.** N'effectue **aucun appel réseau** : génère/retourne les instructions e-Transfer et laisse le statut à l'action admin de réconciliation. Joue le rôle exact que `PhotonPlacesService` joue pour les adresses (le **défaut sans clé**).
- **`VoPayPaymentService`** / **`PaysafePaymentService`** — **stubs documentés, keyless** (`ApiKey: ""` dans `appsettings*.json`), exactement comme `GooglePlacesService`/`RadarPlacesService` existent **sans clé active**. Présents pour montrer l'extensibilité (Strategy/OCP) **sans jamais être le défaut** et **sans frais tant que la clé est vide**. Tout passage à un de ces adaptateurs **exige l'accord explicite du propriétaire** (budget).

### 4.3 Sélection par config en DI

Dans `Infrastructure/DependencyInjection.cs`, un `switch` sur `Payments:Provider` (défaut → `ManualInteracPaymentService`), miroir du `switch` `Places:Provider` existant (lignes 133-154). Aucune logique de paiement dans les contrôleurs ni dans `Program.cs` au-delà de l'enregistrement.

### 4.4 Où s'accroche le statut de paiement

Le domaine **porte déjà** des machines à états par agrégat — on **réutilise l'idiome, on ne crée pas un 2ᵉ mécanisme** (`design-patterns.md` §2) :

- **`Order`** (`Domain/Entities/Order.cs`) : enum **`OrderStatus { Pending, Confirmed, Shipped, Delivered, Cancelled }`** où `Pending` = *« En attente de paiement »* et `Confirmed` = *« Paiement reçu »* (commentaires déjà dans `OrderStatus.cs`). La transition est **déjà** gardée par `Order.Confirm()` (`Status != Pending → BusinessRuleException`). Une confirmation de paiement appelle simplement `order.Confirm()`.
- **`RentalContract`** : `RentalStatus { Active, Expired, Cancelled }`.
- **`BookingSlot`** : `BookingStatus { Pending, Confirmed, Completed, Cancelled }`.

> **Recommandation de modélisation — PAS d'entité `Payment` lourde pour le MVP.** Argument : (1) le statut de paiement **coïncide déjà** avec `Pending → Confirmed` sur les trois agrégats — ajouter une entité `Payment` **dupliquerait** une machine à états existante (anti-patron « 2ᵉ mécanisme », `design-patterns.md` §2-3) ; (2) l'e-Transfer manuel **ne stocke aucune donnée bancaire** → il n'y a quasiment rien à persister hormis une **référence** et un **moment de confirmation**. Le strict nécessaire : un **`PaymentReference` non devinable** (Guid/opaque) + un timestamp de confirmation, **portés par l'agrégat** (champs sur `Order`/`RentalContract`/`BookingSlot`) ou un petit *owned value object* `PaymentInfo`. Une entité `Payment` dédiée ne se justifie **que** si plusieurs tentatives/partiels/remboursements doivent coexister par commande — ce que le MVP **n'a pas**. À trancher en §7.

### 4.5 Webhooks signés & idempotence — **patron futur, NON codé**

Le MVP manuel **n'a pas de webhook** (la confirmation est une action admin). Si un adaptateur API est un jour activé, l'e-Transfer peut prendre **10 s à 30 min** → **jamais** d'attente synchrone sur la route de paiement. Le patron à décrire (sans l'implémenter) :

- **Un contrôleur API** `[AllowAnonymous]` recevant l'événement « payé », **vérification de signature HMAC** du corps brut avant tout traitement, **toujours répondre `200`** pour stopper les relances du fournisseur.
- **Idempotence** : table `idempotency_key` (ou colonne unique sur la référence) ; un même événement rejoué ne **re-confirme pas** la commande (`Order.Confirm()` lève déjà si l'état n'est plus `Pending` — garde naturelle, **L-046** : ré-appliquer l'invariant sur **tout** chemin d'écriture). Les erreurs métier remontent au **`GlobalExceptionHandler`** (RFC 9457), comme partout.

> Conforme à `design-patterns.md` §1 : **hand-roll** la vérif de signature + l'idempotency-key (quelques dizaines de lignes), **pas** de dépendance pour un patron simple — précédent MediatR → `Dispatcher`.

---

## 5 · Implications Loi 25 / sécurité

| Sujet | MVP e-Transfer manuel | Ce qui change avec une **API** (VoPay/Paysafe/…) |
|-------|----------------------|--------------------------------------------------|
| **Données bancaires** | **Aucune** stockée ni transitée (le client paie dans sa banque). **Avantage MVP majeur.** | Données de paiement transitent → **PCI-DSS** (cartes), KYC/AML (Interac via intermédiaire). |
| **Référence de commande** | **Non devinable** (Guid/opaque, jamais un compteur séquentiel) pour éviter la corrélation/énumération. | Idem + jeton de transaction fournisseur. |
| **Secrets** | Aucun (keyless). | Clé/secret **jamais côté client** ; user-secrets en dev → Key Vault en prod (cf. `CLAUDE.md`). |
| **Webhooks** | N/A. | **Signature HMAC** vérifiée + **idempotence** obligatoires (§4.5). |
| **Journalisation** | Journaliser la **création** de la référence et la **confirmation admin** (qui, quand) sans donnée sensible. | + journaliser les événements webhook (sans secret). |
| **Loi 25** | Surface minimale ; consentement/finalité documentés (cf. backlog EPIC 16 §4 — cookies/consentement). | Sous-traitant de paiement = **registre des communications/tiers**, clause de traitement. |

---

## 6 · Recommandation

**Livrer d'abord le MVP « e-Transfer manuel à dépôt automatique »** comme **adaptateur par défaut keyless** (`ManualInteracPaymentService`), avec le **statut de paiement porté par les agrégats existants** (`Order.Confirm()` etc.) et une **référence de commande non devinable** — **aucun code payant, aucune clé, aucun stockage bancaire, aucun webhook.** C'est la **seule** option qui satisfait la contrainte cardinale §2, et c'est l'analogue exact de `PhotonPlacesService` (défaut sans clé).

**Prévoir** les **stubs keyless** `VoPayPaymentService` / `PaysafePaymentService` (façon `Google`/`Radar`PlacesService, `ApiKey: ""`) **uniquement pour documenter l'extensibilité** — jamais activés par défaut. **Une API ne sera envisagée que SI** un fournisseur **gratuit-sans-carte** apparaît (improbable vu §2-3) **OU** si le propriétaire **accepte explicitement un coût** (frais de transaction + contrat marchand). Pour une **démo portfolio** de tunnel carte, **Stripe en mode test** (sandbox, sans carte) est acceptable, **isolé du flux réel**.

---

## 7 · Décisions à prendre (⏳ à confirmer avec le propriétaire avant tout code)

- [ ] **MVP manuel SEUL** (recommandé) **vs MVP manuel + stubs API keyless** documentés pour le futur ?
- [ ] **Quels flux** reçoivent l'étape de paiement : **commandes (`Order`)**, **locations (`RentalContract`)**, **installations (`BookingSlot`)** — **les trois** ou un **sous-ensemble** (ex. commandes seules pour le MVP) ?
- [ ] **Modélisation du paiement** : **statut sur l'agrégat** + `PaymentReference`/`PaymentInfo` (recommandé — pas de duplication de machine à états) **vs entité `Payment` dédiée** (seulement si tentatives/partiels/remboursements multiples requis) ?
- [ ] **e-Transfer manuel seul** (US-7.1) **vs + Interac Debit / AccèsD** (US-7.2, **payant → accord budget requis**) ?
- [ ] **Cartes de crédit** dans le périmètre ? (PCI + contrat processeur → **payant → accord budget requis** ; sinon **Stripe test** pour démo uniquement).
- [ ] **Périmètre portfolio (démo) explicitement assumé** : on reste **bac-à-sable / sans encaissement réel**, documenté comme tel (aucun mouvement d'argent réel) ?
- [ ] Si une API est un jour activée : **réutiliser le payout** pour la **paie EPIC 8** (US-8.2, *Won't now*) — confirmer que cela reste **hors périmètre** ?

---

## 8 · Effort / estimation (si on implémentait le MVP manuel)

US-7.x = **MoSCoW « Could »** (`product-backlog.md` lignes 143-145) — donc **différable**. Si lancé via `/feature-cycle` :

| Lot | Contenu | Estim. |
|-----|---------|:------:|
| **MVP US-7.1 (manuel)** | Port `IPaymentService` + `ManualInteracPaymentService` (keyless, défaut) + `switch` config en DI ; `PaymentReference`/`PaymentInfo` sur `Order` (migration EF — **L-001/L-045** : index/owned, soft-delete) ; commande CQRS « confirmer paiement » (admin) réutilisant `Order.Confirm()` ; étape de paiement Angular (instructions e-Transfer, états `aria-live`, WCAG AA) ; tests unitaires/intégration + e2e dual-thème. | **~8 pts** |
| **US-7.3 (port + stubs + webhooks patron)** | Stubs keyless `VoPay`/`Paysafe` (non activés) + **documentation** du patron webhook signé/idempotent (non codé tant qu'aucune API n'est activée). | **~5 pts** (dont l'essentiel = doc/stubs) |
| **US-7.2 (Interac Debit / cartes API)** | **Bloqué par décision budget** (payant). Non estimé tant que non accordé. | **— (gelé)** |

> Total MVP réaliste sans option payante : **~13 pts**. Le reste (21+ pts annoncés) inclut les rails API **gelés par le budget**.

---

### Sources

- [VoPay — Pricing](https://vopay.com/pricing/) (tarif sur devis, onboarding compliance) · [VoPay — Interac e-Transfer API](https://vopay.com/payment-methods/etransfer/) · [VoPay — Software Advice profile 2026](https://www.softwareadvice.com/online-payment/vopay-profile/)
- [Hyperswitch (Juspay) — site](https://hyperswitch.io/) · [GitHub juspay/hyperswitch (Apache-2.0, Rust, self-host)](https://github.com/juspay/hyperswitch) · [Hyperswitch — Self-Hosting docs](https://docs.hyperswitch.io/self-hosting)
- [Paysafe Developer — Interac e-Transfer](https://developer.paysafe.com/en/api-docs/payments-api/add-payment-methods/interac-e-transfer/) · [Paysafe Review 2026 (fees/approval)](https://thefinrate.com/paysafe-review-2026-high-risk-merchant-accounts-fees-approval-rates/) · [Interac Corp. — Understanding Fees](https://www.interac.ca/en/payments/business/understanding-fees/)

---

**Fichiers réels ancrant ce spike :**
- Port idiome : `src/AbrisAutoOutaouais-WebApp.Application/Common/Interfaces/IPlacesService.cs`
- Adaptateurs + sélection config : `src/AbrisAutoOutaouais-WebApp.Infrastructure/Services/Places/{PhotonPlacesService,GooglePlacesService,RadarPlacesService,PlacesOptions}.cs` · `src/AbrisAutoOutaouais-WebApp.Infrastructure/DependencyInjection.cs` (lignes 133-154)
- Agrégats & statuts : `src/AbrisAutoOutaouais-WebApp.Domain/Entities/Order.cs` (`Confirm()` garde déjà `Pending`) · `Domain/Enums/{OrderStatus,RentalStatus,BookingStatus}.cs`
- Commande à étendre : `src/AbrisAutoOutaouais-WebApp.Application/Orders/Commands/PlaceOrder/PlaceOrderCommand.cs`
- Handler d'erreurs RFC 9457 : `src/AbrisAutoOutaouais-WebApp.API/Middlewares/GlobalExceptionHandler.cs`
- Règles : `.claude/rules/budget-free-tier.md` (§2) · `.claude/rules/design-patterns.md` §1-2 (hand-roll, réutiliser l'idiome) · `docs/agile/ROADMAP-PHASE-2.md` (EPIC 7) · `docs/agile/product-backlog.md` (US-7.1/7.2/7.3)
