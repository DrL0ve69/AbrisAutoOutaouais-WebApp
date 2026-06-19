# Budget « zéro frais » — règle dure (AbrisTempo Local)

> **Ce que c'est.** Une contrainte **non négociable** posée par le propriétaire du projet : l'app doit
> se construire et tourner **sans dépenser d'argent**. La seule ressource payée déjà acquise est le
> **crédit étudiant Azure (~120 $ CA)** ; on ne le dépasse pas. Le hook `PostToolUse`
> (`post-edit-guardrail.mjs`) pointe ici sur toute édition de dépendance/fournisseur/config
> (`package.json`, `*.csproj`, `appsettings*.json`, `DependencyInjection.cs`). Cousine de
> `.claude/rules/design-patterns.md` §1 (coder-soi-même vs ajouter une dépendance) sur l'axe **coût**.
>
> **Règle d'or :** *jamais de dépense, d'abonnement, de clé API facturée ni de service payant — sans
> le consentement explicite du propriétaire.* Par défaut on choisit du **gratuit ET sans clé**.

---

## 1 · La décision — avant tout fournisseur / `dotnet add package` / `npm i` d'un SDK hébergé

- [ ] **Gratuit ET sans clé ?** Priorise le keyless/open : **Photon** (géocodage défaut), **Nominatim**,
      tuiles **Esri World Imagery** / **OSM**, **Leaflet** + `@geoman-io/leaflet-geoman-free`, **Turf**.
- [ ] **Le « tier gratuit » exige-t-il un compte de facturation / une carte de crédit ?** Si oui →
      **traité comme PAYANT → refusé.** Un « free tier » qui peut **facturer au dépassement** (Google
      Maps Platform / Earth Engine, Algolia, Radar, Mapbox au-delà du quota…) est exclu par défaut :
      le risque de frais existe. On ne « met pas juste une carte au cas où ».
- [ ] **Coût documenté dans le PR.** Toute nouvelle dépendance externe / tout appel à un tiers indique
      explicitement : *gratuit + sans clé* / *gratuit avec compte mais sans carte* / *facturable* (→ à
      refuser sauf accord). Pas de service réseau ajouté en silence.
- [ ] **Azure.** S'en tenir aux paliers gratuits documentés dans `docs/deployment.md` : Static Web Apps
      **Free**, Container Apps **free grant**, Azure SQL **S0** (sur le crédit étudiant). Ne pas
      provisionner de SKU payant ni dépasser le crédit. Toute ressource cloud nouvelle = vérifier le palier.

---

## 2 · Précédent à connaître — l'outil `/mesurer` est gratuit de bout en bout

`/mesurer` fait **déjà** « adresse → satellite → tracé → largeur/longueur → suggestion d'abri »
**sans aucune clé API** : Leaflet + geoman-free + tuiles **Esri World Imagery** (keyless) + Turf +
géocodage **Photon** (défaut keyless de `IPlacesService`).

- **Google Maps Platform / Google Earth Engine ont été évalués (docx 2026-06-19) et REJETÉS** : ils
  exigent un **compte de facturation** (carte de crédit, facturation au dépassement) → contraire à
  cette règle, **et redondants** (la capacité existe déjà gratuitement). **Ne pas re-proposer.**
- Les adaptateurs `GooglePlacesService` / `RadarPlacesService` existent mais restent **volontairement
  sans clé** (`appsettings*.json` → `ApiKey: ""`). Le défaut reste **Photon**.
- Avant d'ajouter un fournisseur de données (cartes HD, géocodage, paiement…), consulter d'abord
  `docs/resources.md` (sources d'API **gratuites** vérifiées : `public-apis`, `free-for-dev`).

---

## 3 · Anti-patrons à refuser en revue

- [ ] **Clé API facturée** (Google Maps/Places, Mapbox payant, OpenAI/LLM payant…) introduite sans
      accord explicite → refus ; chercher l'équivalent keyless (cf. §1).
- [ ] **« On active la facturation pour le tier gratuit »** → non : un tier qui requiert une carte est
      traité comme payant (§1).
- [ ] **SKU Azure payant / dépassement du crédit étudiant** sans accord → refus.
- [ ] **Service tiers réseau ajouté sans ligne de coût dans le PR** → documenter ou retirer.

---

**Pré-commit, sur un diff touchant dépendances / fournisseur / config cloud :** gratuit **et** sans
clé (ou gratuit sans carte) ? aucun tier « facturable au dépassement » introduit sans accord ? coût
documenté dans le PR ? palier Azure gratuit respecté ? Au moindre doute sur un frais possible —
**stop, demander au propriétaire** (cf. consigne PS du docx 2026-06-19).
