# Microservices — ce que c'est, quand (ne pas) les utiliser

> **Ce que c'est.** Un guide de décision sur l'architecture **microservices**, ancré au cas réel de
> ce dépôt : AbrisTempo Local est un **monolithe modulaire** (.NET 10, Clean Architecture, un seul
> `ApplicationDbContext`, déployé en **un** conteneur backend + un site statique frontend). On
> explique ce que seraient des microservices ici, *pourquoi on ne les a pas choisis*, et la **bonne
> option par cas**.
>
> Message court : **les microservices résolvent un problème d'organisation et d'échelle, pas un
> problème de code.** Pour ce projet, le monolithe modulaire est le bon choix — et le rester est une
> décision, pas un défaut.

---

## 1. Définition

Un **microservice** est un service **déployable indépendamment**, qui possède **ses propres données**
et communique avec les autres par le **réseau** (HTTP/gRPC/messages), autour d'**une** capacité
métier. Une architecture microservices, c'est *plusieurs* de ces services formant une application.

À l'opposé, un **monolithe** déploie toute l'application en **une seule unité**. Entre les deux, le
**monolithe modulaire** : une seule unité de déploiement, mais un **découpage interne strict** en
modules à frontières nettes (c'est exactement ce dépôt — voir §4).

```
Monolithe                 Monolithe modulaire           Microservices
┌───────────────┐         ┌───────────────────┐         ┌─────┐  ┌─────┐  ┌─────┐
│  tout mêlé    │         │ [Cmd][Loc][Resa]  │         │ Cmd │  │ Loc │  │Resa │
│               │         │  frontières       │         │ +DB │  │ +DB │  │ +DB │
│   1 DB        │         │  1 déploiement·1DB│         └──┬──┘  └──┬──┘  └──┬──┘
└───────────────┘         └───────────────────┘            └─ réseau / messages ─┘
```

**Ce qui distingue vraiment un microservice** (et le rend coûteux) : *base de données privée* (pas de
table partagée) + *déploiement indépendant* + *communication réseau*. Sans ces trois, on a juste un
monolithe distribué — le pire des deux mondes.

---

## 2. Quand les microservices se justifient

Ce sont des solutions à des problèmes que **ce projet n'a pas (encore)** :

- **Échelle organisationnelle.** Plusieurs équipes qui se gênent dans le même dépôt/déploiement.
  Des frontières de service = des équipes qui livrent sans se coordonner. (« *Loi de Conway* » :
  l'archi finit par copier l'organigramme — autant la choisir.)
- **Échelle technique asymétrique.** Une partie doit scaler **indépendamment** : p. ex. un moteur de
  recherche ou un traitement d'images sollicité 100× plus que le reste, qu'on veut dimensionner et
  déployer seul.
- **Cycles de vie / contraintes hétérogènes.** Un module a besoin d'une autre techno (Python pour du
  ML), d'une autre cadence de déploiement, ou d'un isolement réglementaire (paiement PCI séparé).
- **Isolation de panne.** On veut qu'une défaillance d'un domaine (ex. recommandations) **ne fasse
  pas tomber** la prise de commande.
- **Déploiements très fréquents et indépendants** par domaine, à grande échelle.

**Règle empirique :** si la motivation est *« mon code est en désordre »*, un microservice **n'y
changera rien** — un monolithe mal rangé devient un *distribué* mal rangé, en pire. La motivation
valide est presque toujours **humaine et opérationnelle** (équipes, scale, déploiement), pas
esthétique.

---

## 3. Quand NE PAS les utiliser (le coût réel)

Les microservices **achètent** de l'indépendance en **payant** une complexité distribuée énorme :

- **Pas de transaction ACID entre services.** Une commande qui touche stock + paiement + livraison ne
  peut plus être un simple `SaveChanges()` transactionnel : il faut des **sagas**, de la
  **cohérence à terme**, des compensations. (Dans ce dépôt, `PlaceOrder` est *une* transaction — un
  luxe qu'on perdrait.)
- **Le réseau échoue.** Latence, *retries*, *timeouts*, *circuit breakers*, idempotence : chaque
  appel intra-app devient un appel réseau faillible.
- **Observabilité distribuée.** Tracing corrélé, logs agrégés, *health checks* — sinon déboguer
  devient un cauchemar.
- **Ops démultipliées.** N pipelines CI/CD, N images, *service discovery*, versionnage de contrats,
  souvent Kubernetes. Pour une petite équipe, c'est un *second métier*.
- **Frontières figées trop tôt.** Découper avant de connaître les vrais axes de changement = des
  appels réseau chatty là où il aurait fallu une frontière ailleurs. **On découpe mal ce qu'on
  comprend mal.**

> **Pour AbrisTempo Local précisément** : une seule équipe, un trafic régional modeste, trois domaines
> (ventes / locations / réservations) qui **partagent** des données (produits, adresses, utilisateurs)
> et des **transactions** (une commande = stock + paiement). Tout pointe vers le **monolithe
> modulaire**. Les microservices ajouteraient des sagas et du réseau pour **zéro bénéfice** ici.

---

## 4. Notre choix : le monolithe modulaire (et pourquoi c'est le bon)

Ce dépôt obtient **la plupart des bénéfices** souvent attribués aux microservices — **sans** le coût
distribué — grâce à des frontières internes strictes :

- **Modules par domaine** : `Application/Orders`, `Application/Bookings`, `Application/Rentals`… —
  chaque cas d'usage isolé en commande/handler (CQRS), couplage faible *à l'intérieur* d'un seul
  binaire.
- **Frontières d'architecture** imposées par la Clean Architecture (Domain ← Application ←
  Infrastructure/API) : la discipline qui rendrait l'extraction d'un service *facile le jour venu*.
- **Une transaction, une base** : intégrité forte gratuite (`ApplicationDbContext` unique).
- **Un déploiement** : un conteneur backend (Azure Container Apps) + un site statique (Azure Static
  Web App) — CI/CD simple, débogage local trivial.

**C'est le « monolith first » recommandé** (Fowler) : on commence monolithe modulaire, et si un module
*prouve* qu'il a besoin d'indépendance (scale/équipe/panne), ses frontières propres le rendent
**extractible en microservice** sans réécriture. On garde l'option ouverte sans en payer le prix
d'avance.

---

## 5. La meilleure option, par cas

| Situation | Meilleure option | Pourquoi |
|---|---|---|
| **Ce projet aujourd'hui** (1 équipe, trafic modéré, données/transactions partagées) | **Monolithe modulaire** ✅ | Intégrité ACID, ops simples, frontières nettes = extractible plus tard. |
| App neuve, périmètre encore flou | **Monolithe modulaire d'abord** | On découpe *après* avoir compris les axes de changement (« monolith first »). |
| Plusieurs équipes qui se gênent, scale par domaine, déploiements indépendants | **Microservices** | Indépendance d'équipe/déploiement/scale qui dépasse leur coût. |
| Un seul traitement isolé, événementiel, à scale élastique (image, e-mail, webhook) | **Serverless / Functions** (Azure Functions) | Scale-to-zero, pas de serveur à gérer — sans découper toute l'app. |
| Découpler des effets de bord sans cohérence forte (envoyer un e-mail après commande) | **File de messages / events** (queue, `IDomainEvent` → handler async) | Asynchrone et résilient tout en restant *dans* le monolithe. |
| Besoin d'indépendance partielle sans full microservices | **Modular monolith + 1–2 services extraits** | N'extraire **que** le module qui le prouve ; garder le reste mono. |
| Front + back séparés mais app simple | **Découpage client/serveur** (déjà le cas : Angular SSR + API .NET) | Suffit largement ; ce n'est *pas* « des microservices ». |

**Heuristique de décision :**
1. Commence **monolithe modulaire**.
2. Un besoin asynchrone/événementiel ? Ajoute **messages/events** *avant* de découper.
3. Un pic de charge sur **un** traitement isolé ? **Functions/serverless** pour celui-là.
4. **Microservice** seulement quand un module a une vraie raison **organisationnelle ou de scale** —
   et alors, extrais **ce** module, pas tous.

---

## 6. À retenir

- Microservices = réponse à un problème **d'organisation/échelle/déploiement**, pas de propreté de code.
- Leur coût (sagas, réseau, ops ×N, cohérence à terme) est **réel et permanent** — ne le paie que si
  le bénéfice le dépasse.
- Le **monolithe modulaire** de ce dépôt donne déjà les frontières, l'isolation logique et
  l'intégrité, **sans** ce coût — et reste extractible si un jour un domaine le justifie.
- Entre les deux extrêmes : **events/messages** et **serverless** couvrent la majorité des « j'ai
  besoin d'un peu d'indépendance » sans tout distribuer.

*Repères : M. Fowler — « MonolithFirst » et « Microservice Trade-Offs » (martinfowler.com) ; S. Newman
— « Building Microservices » (O'Reilly). Pour le déploiement concret de cette app, voir
`docs/deployment.md` ; pour l'IaC qui provisionne le tout, `docs/infra-terraform.md`.*
