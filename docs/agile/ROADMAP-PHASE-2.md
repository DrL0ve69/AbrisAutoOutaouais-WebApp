# Roadmap — Phase 2 (fonctionnalités métier avancées)

> **Statut : PLANIFICATION SEULEMENT — aucun code écrit.** Ce document capture six demandes
> utilisateur (source : `probleme abris-auto-outaouais.docx`, 2026-06-16) comme **épopées à
> compléter plus tard**. Il décrit le *quoi* et le *comment envisagé* ; il ne change **aucun**
> comportement de l'application. Chaque épopée passera par la boucle habituelle
> (`/feature-cycle` : architecte → développeur → revue indépendante → mentor) **au moment de son
> implémentation**.
>
> **Pré-requis de programme.** La Phase 1 (Programmes A→F puis G, épics A→H) est livrée et en ligne ;
> la seule tâche restante du Programme G est **Épic H — déploiement backend manuel**
> (`docs/deployment.md` §4.2). La Phase 2 ci-dessous est **postérieure** et **non engagée** : à
> prioriser avec l'utilisateur quand il le décidera.
>
> **⚠️ Correction d'architecture importante.** La conversation copiée dans le `.docx` (recherche sur
> les paiements) suppose un backend **Node.js / Express** et donne des extraits de code Express. **Ce
> dépôt n'est PAS Node/Express** : c'est **.NET 10 / C# 14**, Clean Architecture, **Mediator maison**
> (`Application/Common/Mediator/`), front **Angular 21**. **Les extraits Express du `.docx` ne
> s'appliquent pas tels quels** — toute intégration de paiement doit suivre l'idiome du dépôt (port
> `Ixxx` dans Application + adaptateur par fournisseur dans Infrastructure, sélection par config en DI,
> exactement comme `IPlacesService` ; webhooks = un contrôleur API ; voir `.claude/rules/design-patterns.md` §2).

---

## Index des épopées Phase 2

| ID | Épopée | Point `.docx` | Dépend de | Estim. | MoSCoW | Risque |
|----|--------|:-------------:|-----------|:------:|:------:|--------|
| **EPIC 7** | Paiements en ligne (Interac e-Transfer + cartes) | 1 | — | 21+ | Could | 🔴 Élevé (réglementaire, frais, sécurité) |
| **EPIC 8** | Gestion des employés & paie (informative) | 2 | EPIC 11 | 8–13 | Could | 🟠 Moyen (conformité fiscale si paie réelle) |
| **EPIC 9** | Catalogue par dimensions configurables | 3 | — | 13 | Should | 🟠 Moyen (refonte modèle de données) |
| **EPIC 10** | Suggestion d'abris intelligente (mesure & véhicule) | 4 | EPIC 9 | 8 | Should | 🟢 Faible (étend l'existant) |
| **EPIC 11** | Calendrier & planification terrain (horaires, RDV, routage) | 5 | — | 21 | Could | 🟠 Moyen (nouveau domaine + routage) |
| **EPIC 12** | Correctifs de contraste formulaires/focus | 6 | — | 3 | **Should** | 🟢 Faible (a11y ciblée) |

**Ordre conseillé d'attaque** : **EPIC 12** (rapide, barre a11y dure, autonome) → **EPIC 9 → EPIC 10**
(la chaîne catalogue/fit, valeur métier directe) → **EPIC 11** (calendrier, gros mais autonome) →
**EPIC 8** (paie informative, s'appuie sur 11) → **EPIC 7** (paiements, le plus risqué — à traiter en
*spike de recherche* d'abord, et probablement en mode bac-à-sable pour un portfolio).

---

## EPIC 7 — Paiements en ligne (Interac e-Transfer + cartes)

> **Source : point 1.** L'utilisateur cherche une alternative **gratuite / open-source** à Stripe,
> orientée clientèle **Québec + Ottawa** (Desjardins et autres banques), avec **Interac** — de
> préférence l'**e-Transfer par courriel/téléphone/ID** (« demande d'argent »), avec possibilité de
> redirection instantanée **Interac Debit / AccèsD** plus tard.

### État actuel
- Les parcours **vente / location / installation** créent bien des commandes/contrats/réservations
  (Épics A→G), avec compte invité express (Épic F). **Aucun paiement n'est encore encaissé** — il
  n'existe ni port de paiement, ni statut de paiement, ni webhook.

### Ce qu'il faut faire (vision)
1. **Choisir le modèle de paiement** (voir « Décisions à prendre » plus bas). Recommandation de
   départ pour un portfolio : commencer par le **MVP « e-Transfer manuel à dépôt automatique »**
   (gratuit, sans tiers, sans contrat), puis envisager une API.
2. **Modéliser le paiement dans le domaine** : un statut de paiement sur `Order` / `RentalContract` /
   `Booking` (machine à états : `EnAttente → PaiementRequis → Payé / Échoué / Remboursé`). Les
   transitions sont gardées dans les handlers (idiome State léger, `design-patterns.md` §2).
3. **Port `IPaymentService`** (Application) + adaptateurs (Infrastructure), **calqués sur
   `IPlacesService`** : sélection du fournisseur **par config** en DI (Strategy). Chaque adaptateur
   émet le **format canonique** attendu par les validateurs/handlers (leçon **L-011**).
4. **Webhooks asynchrones** : un contrôleur API (`[AllowAnonymous]` + **vérification de signature**)
   qui reçoit l'événement « payé », **idempotent**, et renvoie toujours `200` pour stopper les
   relances. L'e-Transfer peut prendre **10 s à 30 min** → ne **jamais** attendre la réponse en
   synchrone sur la route de paiement (cf. `.docx`).
5. **Frontend** : étape de paiement dans le tunnel (choix « e-Transfer » / « carte » / « Interac
   Debit »), états annoncés `aria-live` (paiement en attente / confirmé), repli accessible.

### Architecture cible (idiome du dépôt — PAS l'Express du `.docx`)
```
[ Angular ] ──(commande)──► [ API .NET (contrôleur mince) ]
                                   │  dispatcher.DispatchAsync(PlaceOrderCommand…)
                                   ▼
                        [ Application : IPaymentService (port) ]
                                   │  (Strategy par config)
                  ┌────────────────┼─────────────────────────┐
                  ▼                ▼                          ▼
   ManualInteracService   VoPayPaymentService        PaysafePaymentService   (Infrastructure)
   (MVP gratuit)          (API Interac e-Transfer)   (API Interac + cartes)
                                   ▲
        [ Webhook controller ] ◄───┴── événement « payé » (asynchrone, signé, idempotent)
```

### Options de fournisseur (résumé fidèle du `.docx` + correctifs)
| Option | Rôle | Gratuit ? | Note |
|--------|------|-----------|------|
| **e-Transfer manuel + dépôt auto** | MVP sans API | ✅ **Vraiment gratuit** | Générer une référence de commande ; le client envoie un e-Transfer à dépôt automatique avec la référence ; l'admin réconcilie. **Aucun tiers, aucun frais d'API.** Recommandé en premier pour un portfolio. |
| **Hyperswitch** | Orchestrateur open-source (self-host) | ✅ Logiciel gratuit | « Remplace la logique frontend/routing de Stripe » ; **on paie quand même les frais du processeur en aval**. SDK pensé Node — à intégrer côté .NET via ses API HTTP. |
| **VoPay** | API open-banking canadienne | ❌ Contrat payant | API **Interac e-Transfer** (demande d'argent, confirmation de statut, plafonds élevés ~25 000 $). |
| **Paysafe** | Processeur canadien | ❌ Contrat payant | API native Interac e-Transfer **+ cartes** pour e-commerce. |
| **Payment Source / Konek** | Interac Direct | ❌ Contrat payant | Redirection AccèsD Desjardins (« Interac Debit »). |
| Stripe (mode test) | Cartes (+ certains rails CA) | ⚠️ Frais en prod | Utile en **sandbox** pour une démo portfolio sans contrat bancaire. |
| Lago / Flexprice / Polar | Facturation SaaS | — | **À éviter ici** (`.docx`) : conçus pour le SaaS metering, pas le panier/checkout e-commerce ni les rails de paiement de détail. |

### Décisions à prendre (⏳ à confirmer avec l'utilisateur avant tout code)
- [ ] **MVP gratuit (e-Transfer manuel) d'abord, API ensuite ?** (recommandé) ou directement une API ?
- [ ] **e-Transfer (demande courriel/téléphone/ID)** seul, ou **+ Interac Debit (redirection AccèsD)** ?
- [ ] **Cartes de crédit** dans le périmètre ? (implique PCI + un contrat processeur)
- [ ] **Mode bac-à-sable** (démo portfolio) vs réel (contrat bancaire) ?

### ⚠️ Avertissements (à ne pas perdre de vue)
- **Interac est un réseau interbancaire fermé canadien** : un outil open-source **ne peut pas**
  parler directement à Desjardins/RBC/TD — il **faut un intermédiaire canadien réglementé** (VoPay,
  Paysafe, Payment Source…). Le « gratuit » concerne l'**orchestrateur** (Hyperswitch), pas le
  mouvement d'argent (frais de transaction inévitables hors e-Transfer manuel).
- **Sécurité** : vérification de signature des webhooks, idempotence, jamais de secret côté client,
  PCI si cartes. Pour un portfolio, **rester en mode test/sandbox** est probablement le bon choix.

### Estimation : 21+ pts (dont un **spike de recherche** dédié au préalable). MoSCoW : **Could**.

---

## EPIC 8 — Gestion des employés & paie (informative)

> **Source : point 2** (« le système de paiement pourrait-il aussi servir à payer les employés ? »)
> couplé au **point 5** (tableau des heures travaillées / statut des heures payées).

### Ce qu'il faut faire (vision)
- Nouvelle entité **`Employee`** (domaine) + rôle existant `Staff`.
- Suivi des **heures travaillées** par employé et par jour (saisi via le calendrier — EPIC 11), avec
  un **statut de paie** (`À payer` / `Payée`) → **tableau informatif** pour l'admin.
- **Versement de la paie** : techniquement, certaines API du EPIC 7 (VoPay) savent **envoyer** un
  e-Transfer (payout) — donc on *pourrait* réutiliser les rails. **Mais** une vraie paie implique la
  **conformité fiscale** (déductions à la source, RRQ/RPC, AE, T4 / Relevé 1, Revenu Québec + ARC).

### ⚠️ Avertissement (décision de périmètre)
- **La paie réelle conforme est hors de portée d'un portfolio.** Recommandation : livrer un **module
  informatif** (heures travaillées + statut « payé/à payer » + total), **sans** calcul de déductions
  ni virement automatique. Si un versement est souhaité plus tard, le brancher sur le **payout**
  d'EPIC 7 en mode démo seulement, en documentant clairement qu'il n'y a **aucun calcul fiscal**.

### Décisions à prendre
- [ ] **Informatif seulement** (recommandé) ou **versement réel** (réutilise EPIC 7) ?
- [ ] Granularité : heures par jour saisies à la main, ou pointage (clock-in/out) ?

### Estimation : 8 pts (informatif) / 13+ (avec versement). MoSCoW : **Could**. Dépend de **EPIC 11**.

---

## EPIC 9 — Catalogue par dimensions configurables (catégorie → modèle → dimensions)

> **Source : point 3.** Les produits sont bien catégorisés (**simple / double / monopente**, etc.),
> mais après le choix de la catégorie, l'utilisateur **doit pouvoir choisir les dimensions**. La
> largeur et la hauteur dégagée sont **fixes par catégorie** ; la **longueur varie** (modèles de base
> + une **arche tous les 4 pieds**). **Touche : home, boutique, location, installation, livraison,
> panier — et probablement plus.**

### État actuel
- `Product` porte déjà `Brand`/`Model` (Épic G, `string?`) et `WidthCm`/`LengthCm`/`HeightCm`
  (Épic D1, `int?`) — mais **une seule dimension fixe par ligne produit**. Le modèle actuel **ne
  représente pas** « une catégorie = largeur+hauteur fixes + un **éventail** de longueurs ».
- L'endpoint `GET /products/suggest-shelters` (D2) et `/mesurer` filtrent sur ces dimensions fixes.

### Référentiel dimensionnel fourni par l'utilisateur (à compléter)
> Conversion : **1 pi = 30,48 cm** (le dépôt est **cm-canonique**, affichage en pieds — `units.util`, L-004).

| Catégorie | Largeur (fixe) | Hauteur dégagée (fixe) | Longueurs possibles | Max usuel |
|-----------|----------------|------------------------|----------------------|-----------|
| **Simple** | **11 pi** | **6 pi 6 po** (barre de porte horizontale, *pas* le pignon) | 16, 20 (base) puis **+4 pi/arche** → 24, 28, 32, 36, 40 | 40 pi |
| **Monopente** | **~12 pi** *(à confirmer)* | *(à trouver)* | jusqu'à 40 pi (par pas de 4 pi) | 40 pi |
| **Double** | **18 et 20 pi** | *(à trouver)* | jusqu'à 40 pi (par pas de 4 pi) | 40 pi |
| Rangement / porte d'entrée | *(à trouver)* | *(à trouver)* | petits formats | — (non mesurables sur carte — voir EPIC 10) |

- [ ] **Tâche de données** : compléter ce référentiel pour **tous les modèles** depuis
      [abristempo.com](https://www.abristempo.com/en) (largeurs mono/double/autres, hauteurs dégagées,
      pas de longueur exact). C'est un pré-requis d'EPIC 10.

### Décision de modélisation (⏳ clé — à trancher avant tout code)
Deux approches, à arbitrer avec l'architecte :
- **(A) Variantes en lignes produit** : une ligne `Product` par combinaison (ex. `11x16`, `11x20`,
  `11x24`…). Simple à requêter/seed, mais **explosion du nombre de lignes** et duplication de prix/
  description. Compatible avec l'existant (`WidthCm/LengthCm` déjà là).
- **(B) Modèle paramétrique** : une catégorie/modèle porte **largeur+hauteur fixes** + une **liste de
  longueurs autorisées** (et un prix de base + un incrément par arche). La longueur est **choisie à la
  configuration** (panier). Moins de lignes, plus juste métier, mais **refonte** du modèle + tarif.

> Recommandation à challenger : **(B)** colle mieux à la réalité « largeur fixe + longueur
> configurable par pas de 4 pi », et évite la duplication. À valider selon l'effort acceptable.

### Surfaces impactées (point 3 — « plusieurs sections »)
`home` (vedettes), `boutique` (filtre catégorie → puis dimensions), `product-detail`,
`location`, `installation`, `livraison`, `panier` (la dimension choisie suit l'article),
+ `admin/products` (saisie du référentiel), + `/mesurer` (résultats — voir EPIC 10).

### Estimation : 13 pts. MoSCoW : **Should**. **Pré-requis d'EPIC 10.**

---

## EPIC 10 — Suggestion d'abris intelligente (mesure & véhicule)

> **Source : point 4.** Une fois les dimensions modélisées (EPIC 9), proposer **les catégories qui
> rentrent** (pas les dimensions exactes — « ça fonctionne à moitié présentement »), à partir d'une
> **mesure sur carte** ou d'une **sélection de véhicules**.

### État actuel
- `suggest-shelters` (D2) filtre sur `largeur/longueur ≥ requis` et trie par empreinte, avec badge
  « Ajusté serré ». Il raisonne en **dimensions exactes**, pas en **catégories qui conviennent** →
  d'où le « à moitié ».

### Logique cible (capturée depuis les exemples utilisateur)
> Hypothèse métier : on parle d'**abris à voiture** (les abris de rangement / porte d'entrée sont
> **trop petits pour être mesurés sur carte** → exclus de la suggestion auto par carte).

Règle de proposition (entrée : largeur mesurée `W`, longueur mesurée `L`) :
1. Retenir **toute catégorie dont la largeur fixe ≤ `W`** (l'abri doit tenir dans la largeur de
   l'entrée).
2. Pour chaque catégorie retenue, offrir les **longueurs ≤ `L`**, **plafonnées à 40 pi**.
3. L'utilisateur choisit ensuite **modèle + dimension** exacts parmi les options proposées.

**Exemple 1 (utilisateur)** — entrée **30 pi × 40 pi** → proposer **monopente + simple + double**
(toutes rentrent en largeur), longueurs jusqu'à 40 pi.
**Exemple 2 (utilisateur)** — entrée **16 pi × 30 pi** → proposer **monopente + simple seulement**
(double = 18/20 pi > 16 → exclu), longueurs jusqu'à 30 pi (ex. `11x16`, `11x20`, `11x24`, `11x28`).

### Sélection de véhicule — orientation
- En plus du calcul de surface, **demander l'orientation** : véhicules **côte à côte** (additionne
  les **largeurs** + dégagement) **ou** **l'un derrière l'autre** (additionne les **longueurs**). Le
  résultat conditionne quelle catégorie est proposée.

### Décisions à prendre
- [ ] Dégagement (marge) latéral/longitudinal à appliquer autour des véhicules ? (réutiliser
      `TightFitMarginCm` / `IsTightFit` existant ?)
- [ ] Faut-il proposer aussi les abris **plus larges** que l'entrée mais < voie carrossable, ou
      strictement `largeur ≤ W` ? (le point 4 dit « toutes celles qui fit » → strict `≤ W`.)

### Estimation : 8 pts. MoSCoW : **Should**. **Dépend d'EPIC 9.**

---

## EPIC 11 — Calendrier & planification terrain (horaires, RDV, routage)

> **Source : point 5.** Un système de **calendrier** pour l'admin et les employés : voir l'**horaire
> de travail** et les **rendez-vous du jour** ; cliquer un jour → détail sommaire (qui est à
> l'horaire, saisir leurs heures) ; une fois l'horaire du jour complété, **automatiser le trajet le
> plus rapide** puis **déterminer l'heure des rendez-vous** ; **ajouter** RDV/employés directement sur
> le calendrier ou via un overlay-formulaire. L'utilisateur invite à proposer de meilleures pratiques.

### Ce qu'il faut faire (vision)
- **Vue calendrier** (mois/semaine/jour) admin + employé, accessible clavier (APG grid pattern,
  roving `tabindex` — L-015).
- **Détail d'un jour** (overlay/dialog accessible — focus trap + retour de focus, L-006) :
  employés à l'horaire, RDV du jour, **saisie des heures** par employé (alimente EPIC 8).
- **Ajout** de RDV / d'employé à l'horaire directement (formulaire en overlay).
- **Optimisation de tournée** : à partir des **lat/lng** des RDV (déjà géocodés via `IPlacesService`),
  ordonner les visites par **trajet le plus court**, puis **caler les heures** de chaque RDV.
- Les **RDV existent déjà** en partie : les **réservations d'installation** (`Booking`/`BookingSlot`)
  sont des rendez-vous → le calendrier doit **les agréger**, pas créer un second mécanisme (L-024…,
  `design-patterns.md` §2 : réutiliser l'idiome en place).

### Brique « trajet le plus rapide » — options gratuites
| Option | Gratuit ? | Note |
|--------|-----------|------|
| **Heuristique maison (plus proche voisin + Haversine)** | ✅ | On a **déjà** `Domain/GeoDistance` (Haversine) et les lat/lng. MVP **sans dépendance** ni clé : ordonne les RDV, suffisant pour quelques visites/jour. **Recommandé en premier** (idiome « code-le toi-même quand c'est simple », `design-patterns.md` §1). |
| **OpenRouteService** (API) | ✅ Palier gratuit (clé) | Endpoint d'**optimisation** (VRP) + temps de trajet réels par route. À passer **par un proxy backend** (jamais d'appel tiers direct du client — comme `IPlacesService`). |
| **OSRM** (self-host / démo) | ✅ | Routage open-source ; auto-hébergement = infra en plus. |
| Google Directions / Routes | ❌ | Payant ; clé exposée à éviter. |

### Décisions à prendre
- [ ] Modèle de l'**employé** et de l'**horaire** (shift) : entité dédiée + lien aux `Booking` ?
- [ ] Routage : **heuristique maison** (recommandé MVP) ou **OpenRouteService** via proxy ?
- [ ] Les heures de RDV sont-elles **proposées** (modifiables) ou **imposées** par l'algo ?
- [ ] Permissions : un employé voit-il **tout** le calendrier ou **seulement son** horaire ?

### Estimation : 21 pts (gros — découper en sous-épics : calendrier lecture → saisie heures →
ajout RDV/employé → optimisation tournée). MoSCoW : **Could**. **Alimente EPIC 8.**

---

## EPIC 12 — Correctifs de contraste formulaires/focus

> **Source : point 6.** Problèmes de contraste dans **certains formulaires** : **au focus, on ne voit
> pas ce qu'on écrit** (l'utilisateur cite **register** ; « il y en a peut-être d'autres »).

### Constats (confirmés par les captures du `.docx`)
- **Champ d'adresse au focus** (capture 3) : le texte saisi (« mistral ») apparaît **sombre sur fond
  sombre** → illisible pendant la frappe.
- **Boutons CTA** (captures 1, 2, 4, 7) : texte **invisible / très faible** sur le bouton primaire
  rouge (hero d'accueil, panier vide « DÉCOUVRIR LA BOUTIQUE »). **C'est la famille de la leçon
  L-023** (rouge sur rouge + règle globale `a:visited`/`a:hover` qui écrase `.btn--primary` sur les
  ancres-boutons). **À vérifier en priorité** : confirmer si L-023 est déjà déployé en prod ou si une
  régression subsiste (round-trip live **dans les deux thèmes**, **après avoir marqué le lien visité**
  — un bug `:visited` est **invisible à axe/vitest/Playwright** par confidentialité navigateur, L-023).

### Ce qu'il faut faire
- Passe a11y ciblée via le **skill `a11y-ux-pass`** : auditer **tous les `<input>`/`<textarea>`/
  `<select>` au focus** dans les **deux thèmes** (register, login, profil, adresse, caisse, location,
  installation, mesurer, admin). Corriger **au niveau jeton** (`_tokens.scss`), pas en patch local
  (motion-a11y.md §2).
- **Vérification obligatoire** : le contraste se valide en **Playwright e2e + axe dual-thème**
  (`color-contrast` est **désactivé en vitest** par conception — **L-016** ; « zéro axe vitest » ne
  prouve **rien** sur le contraste) + round-trip live dans les deux thèmes (**L-001**). Pour les
  ancres-boutons, ajouter/confirmer la garde `:visited` honnête (L-023).

### Estimation : 3 pts. MoSCoW : **Should** (barre a11y dure WCAG 2.2 AA). **Autonome — bon premier candidat.**

---

## Questions ouvertes transverses (à confirmer avec l'utilisateur)

1. **Périmètre portfolio vs réel** : EPIC 7 (paiements) et la paie d'EPIC 8 ont des contraintes
   réglementaires/financières lourdes. Pour un portfolio, viser **bac-à-sable / informatif** ?
2. **Priorité Phase 2** : confirmer l'ordre conseillé (12 → 9 → 10 → 11 → 8 → 7) ou réordonner.
3. **EPIC 9 — modélisation** : variantes en lignes (A) vs modèle paramétrique (B) ?
4. **Référentiel dimensionnel** : compléter les dimensions manquantes (mono/double/autres) depuis
   abristempo.com avant EPIC 9/10.

> Ces décisions seront tranchées **au lancement de chaque épopée** (avec l'architecte), pas
> maintenant : ce document ne fait que **les rendre explicites** pour plus tard.
