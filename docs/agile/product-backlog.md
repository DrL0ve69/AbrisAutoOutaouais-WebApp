# Product Backlog — AbrisTempo Local

> Backlog produit structuré en **épopées (Epics)** → **user stories** (« En tant que… je veux…
> afin de… ») avec **critères d'acceptation**, **estimation en points** (suite de Fibonacci :
> 1, 2, 3, 5, 8, 13) et **priorisation MoSCoW** (Must / Should / Could / Won't-now).
> Terminologie alignée Azure DevOps (Epic / Feature / User Story / Acceptance Criteria).

L'accessibilité et l'i18n sont traitées comme **exigences transverses** : chaque story porte
les critères a11y dans sa Definition of Done (voir `definition-of-done.md`).

---

## EPIC 1 — Catalogue & vitrine produits

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-1.1 | En tant que **visiteur**, je veux **parcourir les abris par catégorie** afin de trouver rapidement un modèle adapté. | 5 | **Must** | ✅ Livré |
| US-1.2 | En tant que **visiteur**, je veux **voir le détail d'un produit** (prix, location/mois, description, disponibilité) afin de décider en connaissance de cause. | 3 | **Must** | ✅ Livré |
| US-1.3 | En tant que **visiteur**, je veux **ajouter un abri au panier** et voir un retour immédiat afin de constituer ma commande. | 3 | **Must** | ✅ Livré |
| US-1.4 | En tant qu'**administrateur**, je veux **alimenter le catalogue** (seed de produits/catégories) afin que la boutique ne soit pas vide. | 5 | **Must** | ✅ Livré (seed backend) |
| US-1.5 | En tant que **visiteur**, je veux **rechercher et trier** les produits afin de filtrer au-delà des catégories. | 5 | **Should** | ✅ Livré (recherche `role="search"` + tri) |
| US-1.6 | En tant que **visiteur**, je veux une **page panier** révisable afin de vérifier ma commande avant paiement. | 8 | **Should** | ⛔ À faire |
| US-1.7 | En tant que **visiteur**, je veux **mesurer mon stationnement** (carte satellite à dessiner **ou** calculateur de véhicules au clavier) afin que l'app me **suggère un abri qui rentre** et que je choisisse la bonne taille sans erreur. | 13 | **Should** | ✅ Livré (Épic D : dimensions produit `WidthCm/LengthCm/HeightCm` (D1), endpoint `GET /products/suggest-shelters` (D2), feature `/mesurer` stepper Adresse→Mesure→Résultats (D3) — **cm-canonique + affichage en pieds**, radiogroups **APG** (roving tabindex + flèches, L-015), Leaflet+geoman+turf chargés en `@defer`/SSR-safe, badge « Ajusté serré »). **Correctif F2-D (2026-06-14)** : le **mode carte** était en fait **non dessinable** (geoman `map.pm` non attaché) ; rendu fonctionnel par `globalThis.L = L` + import geoman avant `L.map(...)` (L-021), garde e2e de capacité désormais active. **Épic G (G3, 2026-06-16)** : carte `/mesurer` agrandie (breakout CSS + `ResizeObserver`→`invalidateSize`) ; `Brand`/`Model` exposés dans les résultats ; **backfill idempotent** du seeder corrige le fit sur base de dev existante (L-031). |
| US-1.8 | En tant que **visiteur**, je veux **voir la marque et le modèle** de chaque abri suggéré dans les résultats de mesure, et **filtrer les selects installation par marque puis par modèle**, afin de choisir l'abri exact à installer. | 8 | **Should** | ✅ Livré (Épic G, 2026-06-16) — **G1** : `Brand`/`Model` `string?` ajoutés à `Product` (idiome miroir `BookingSlot`, migration `AddProductBrandModel`, seeder enrichi « Abris Tempo » + modèles, propagation commands/validators/DTOs, tests Create/Update) ; **G2** : endpoint `GET /api/v1/products/shelter-catalog` + selects liés marque→modèle dans `features/installation` (dimensions lecture seule, repli catalogue vide, 9 ids i18n fr/en, déterminisme `.ThenBy(Slug)` L-030) ; **G3** : `Brand`/`Model` dans `ShelterSuggestionDto` + affichage `results-step`. |

**Critères d'acceptation — US-1.1**
- `h1` unique sur la page boutique ; chips de catégorie en `<button>` avec `aria-pressed`.
- Sélectionner une catégorie recharge la liste sans rechargement de page.
- États *loading* (`aria-busy`) et *vide* (`role="status"`) annoncés.
- 0 violation axe (e2e Playwright `/boutique`).

**Critères d'acceptation — US-1.3**
- Bouton désactivé (`disabled` + `aria-disabled`) si produit épuisé.
- Toast de confirmation + mise à jour du badge panier (`aria-label` « Panier, N articles »).

---

## EPIC 2 — Authentification & compte

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-2.1 | En tant que **client**, je veux **m'inscrire** (prénom, nom, courriel, nom d'utilisateur, mot de passe fort) afin de créer mon compte. | 5 | **Must** | ✅ Livré (`AuthComponent`) |
| US-2.2 | En tant que **client**, je veux **me connecter par courriel OU nom d'utilisateur** afin de ne pas avoir à retenir un identifiant unique. | 3 | **Must** | ✅ Livré |
| US-2.3 | En tant que **client**, je veux **gérer mes informations personnelles** afin qu'elles soient justes sur mes commandes. | 3 | **Must** | ✅ Livré (onglet Infos) |
| US-2.4 | En tant que **client**, je veux **enregistrer mon adresse de livraison** afin de ne pas la ressaisir (WCAG 3.3.7). | 3 | **Must** | ✅ Livré (onglet Adresse) |
| US-2.5 | En tant que **client**, je veux **changer mon mot de passe** afin de sécuriser mon compte. | 3 | **Must** | ✅ Livré (onglet Sécurité) |
| US-2.6 | En tant que **client**, je veux **réinitialiser un mot de passe oublié** afin de récupérer l'accès. | 5 | **Should** | 🟡 Partiel (page `/auth/reset` accessible ; endpoint backend à venir) |
| US-2.7 | En tant qu'**équipe**, je veux **retirer les écrans d'auth legacy** (`login`, `register.component`) afin d'éliminer la dette et l'incohérence a11y. | 2 | **Should** | ✅ Livré (fichiers legacy supprimés) |
| US-2.8 | En tant que **client**, je veux **saisir mon adresse en champs structurés (numéro civique / appartement / rue) avec autocomplétion accessible et code postal pré-rempli** afin de saisir vite et sans erreur (WCAG 1.3.5 / 4.1.2). | 8 | **Should** | ✅ Livré (Épic C : VO `Address` scindé, combobox APG `shared/.../autocomplete`, proxy Places Photon/Radar/Google, code postal éditable + `aria-live`) |
| US-2.9 | En tant que **client**, je veux **indiquer la marque/modèle de mon abri à installer** afin que l'équipe sache quoi installer (autres marques acceptées sauf ShelterLogic). | 3 | **Should** | ✅ Livré (Épic C fold-in : `BookingSlot.Brand/Model`, exclusion canonique `ExcludedShelterBrands`) |
| US-2.10 | En tant que **client connecté**, je veux **choisir explicitement entre mon adresse de profil (pastille lecture seule) et une autre adresse** quand une adresse est requise (caisse / location / installation / mesurer), afin de réutiliser mon adresse sans la ressaisir tout en gardant la liberté d'en saisir une autre (WCAG 1.3.5 / 2.4.3 / 4.1.3). | 8 | **Should** | ✅ Livré (Épic D : composant partagé `app-address-choice` — pastille `role="group"` + bascule vers le parcours anonyme via `<ng-content>`, focus post-rendu L-006 + `aria-live` scopée L-010 ; autofill robuste D1–D3 ; carte mesurer centrée sur l'adresse géocodée D4 ; zone de service 100 km non bloquante D5, util Haversine miroir client/`GeoDistance`) |
| US-2.11 | En tant que **nouveau client**, je veux être **amené à mon profil après inscription** et **invité (non bloquant) à saisir mon adresse à ma 1re connexion** afin de ne pas la ressaisir plus tard (WCAG 3.3.7 / 4.1.3). | 3 | **Should** | ✅ Livré (Épic E : redirection `/mon-compte/profil` post-register ; alerte `role=status`/`aria-live` scopée profil, marqueur sans migration = adresse vide + `localStorage` par userId, `FirstLoginHintService`) |

**Critères d'acceptation — US-2.1 / 2.2**
- Champ login `type="text"` sans `Validators.email` (accepte courriel ou username).
- `autocomplete="username"`/`current-password`/`new-password` présents → remplissage par gestionnaire de mots de passe (WCAG 3.3.8).
- Aucune épreuve cognitive (pas de CAPTCHA).
- Erreurs par champ : `aria-invalid` + `aria-describedby` + `role="alert"` ; règles de mot de passe en `field__hint`.
- `publicGuard` redirige les utilisateurs déjà connectés.

---

## EPIC 3 — Accessibilité (WCAG 2.2 AA) — transverse

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-3.1 | En tant qu'**utilisateur clavier**, je veux un **skip-link** afin de sauter la navigation. | 2 | **Must** | ✅ Livré |
| US-3.2 | En tant qu'**utilisateur clavier**, je veux un **focus toujours visible** afin de savoir où je suis. | 2 | **Must** | ✅ Livré (`:focus-visible` 3px) |
| US-3.3 | En tant qu'**utilisateur de lecteur d'écran**, je veux des **états annoncés** (`aria-live`, `role=status/alert`) afin de suivre le système. | 3 | **Must** | ✅ Livré |
| US-3.4 | En tant qu'**équipe**, je veux des **tests axe automatisés** (unitaires + e2e) afin de prévenir les régressions a11y. | 5 | **Must** | ✅ Livré (`axe-helper`, `e2e/a11y.spec.ts`) |
| US-3.5 | En tant qu'**utilisateur à basse vision**, je veux des **contrastes ≥ AA** afin de lire confortablement. | 3 | **Must** | ✅ Livré (tokens documentés) |
| US-3.6 | En tant qu'**utilisateur tactile**, je veux des **cibles ≥ 44px** afin de cliquer sans erreur. | 2 | **Should** | ✅ Livré (`min-height: 44px` chips + champs) |
| US-3.7 | En tant qu'**équipe**, je veux **étendre la couverture axe e2e** (auth, profil, états d'erreur) afin de fiabiliser la CI. | 3 | **Should** | ✅ Livré (`/auth`, `/panier` ajoutés) |
| US-3.8 | En tant qu'**utilisateur à basse vision**, je veux que le **redesign v2 (Épic E)** respecte les **contrastes AA dans les deux thèmes**, y compris navbar scrollée (verre), afin que l'esthétique ne dégrade pas la lisibilité. | 3 | **Must** | ✅ Livré (E5 : jeton FIXE `--color-brand-on-dark` pour « Tempo »/icône navbar — était 2.11:1 en clair ; bouton « Voir en 3D » recoloré — était 1.1:1 ; e2e `motion-a11y.spec.ts` dual-thème **navbar scrollée** + repli `reduced-motion` réel ; scan `reschedule.spec.ts` pleine page) |

**Critères d'acceptation — US-3.4**
- Suite axe (tags `wcag2a/2aa/21a/21aa`) verte en local et CI.
- e2e Playwright avec `color-contrast` **actif** sur Accueil/Boutique/Détail → `violations === []`.

**Critères d'acceptation — US-3.8**
- `color-contrast` **actif** en e2e (couleurs composées réelles ; rappel : désactivé en vitest par conception, L-016).
- Balayage axe **deux thèmes × routes redessinées** AVEC défilement (déclenche `.navbar--scrolled`) → `violations === []`.
- Repli `prefers-reduced-motion` **émulé** : hero figé (pas de `.pin-spacer`), cursor-ring masqué, viewer 3D montable sans auto-rotation.
- Bundle initial figé : `index.html` sans `<script>` de lib lourde (gsap/three/leaflet en chunks lazy).

---

## EPIC 4 — Internationalisation (fr / en)

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-4.1 | En tant qu'**équipe**, je veux **baliser les chaînes** avec `i18n`/`$localize` afin de permettre la traduction. | 5 | **Must** | ✅ Livré (balises `@@id`) |
| US-4.2 | En tant qu'**utilisateur**, je veux **basculer FR/EN** afin de consulter le site dans ma langue. | 3 | **Should** | ✅ Livré (sélecteur bouton unique + « langue préférée » du profil → `LocaleService`) |
| US-4.3 | En tant qu'**équipe**, je veux le **build localisé EN** (`build:i18n`) afin de servir `/en/`. | 3 | **Should** | ✅ Livré (`subPath` fr « / » + en « /en/ », hôte bilingue `scripts/serve-i18n.mjs`) |

**Critères d'acceptation — US-4.1**
- `sourceLocale: fr` + locale `en` (`messages.en.xlf`, baseHref `/en/`) dans `angular.json`.
- Chaînes UI balisées avec identifiants stables (`@@home.hero.title`, `@@login.title`, …).
- `npm run i18n:extract` régénère les fichiers de traduction sans perte d'`id`.

---

## EPIC 5 — Thème clair / sombre

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-5.1 | En tant qu'**utilisateur**, je veux **basculer clair/sombre** afin d'adapter le confort visuel. | 3 | **Should** | ✅ Livré (`ThemeService`) |
| US-5.2 | En tant qu'**utilisateur**, je veux que **mon choix persiste** afin de le retrouver à ma prochaine visite. | 2 | **Should** | ✅ Livré (localStorage) |
| US-5.3 | En tant qu'**utilisateur**, je veux que le thème **suive ma préférence système** par défaut. | 2 | **Could** | ✅ Livré (`prefers-color-scheme`) |
| US-5.4 | En tant qu'**utilisateur à basse vision**, je veux des **contrastes AA en sombre** afin de rester lisible. | 3 | **Must** | ✅ Livré (palette sombre tokenisée) |

**Critères d'acceptation — US-5.1 / 5.4**
- Attribut `data-theme="dark"` posé sur `<html>` (prioritaire sur `prefers-color-scheme`).
- `color-scheme` synchronisé (contrôles natifs lisibles).
- Bouton de bascule avec `aria-pressed` + `aria-label` dynamique (« Activer le thème sombre/clair »).

---

## EPIC 6 — Panier & commande (futur)

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-6.1 | En tant que **client**, je veux **consulter/modifier mon panier** afin d'ajuster ma commande. | 8 | **Should** | ⛔ À faire |
| US-6.2 | En tant que **client**, je veux **passer commande** avec une **étape de révision** afin d'éviter les erreurs (WCAG 3.3.4). | 13 | **Could** | ⛔ À faire |
| US-6.3 | En tant que **client**, je veux **réserver une installation** en ligne afin d'éviter l'appel téléphonique. | 13 | **Could** | ⛔ À faire (placeholder) |
| US-6.4 | En tant que **client**, je veux **louer un abri à la saison** afin de payer mensuellement. | 8 | **Won't (now)** | ⛔ Placeholder |

---

## Phase 2 — fonctionnalités métier avancées (⛔ À planifier)

> **Statut : PLANIFICATION SEULEMENT — non engagé, aucun code.** Issu de la demande utilisateur du
> 2026-06-16 (`probleme abris-auto-outaouais.docx`). Détail complet, architecture envisagée, options
> gratuites, avertissements et **décisions à prendre** : **`docs/agile/ROADMAP-PHASE-2.md`**. À
> prioriser avec l'utilisateur après l'Épic H (déploiement). **⚠️ Rappel** : la recherche paiements du
> `.docx` suppose un backend Node/Express — **ce dépôt est .NET 10** ; suivre l'idiome port/adaptateur
> (`IPlacesService`).

### EPIC 7 — Paiements en ligne (Interac e-Transfer + cartes)

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-7.1 | En tant que **client**, je veux **payer ma commande/location/installation par Interac e-Transfer** (demande par courriel/téléphone/ID) afin de payer sans carte de crédit. | 13 | **Could** | ⛔ À planifier (Phase 2) |
| US-7.2 | En tant que **client**, je veux optionnellement **payer par redirection bancaire instantanée (Interac Debit / AccèsD Desjardins)** afin de confirmer le paiement immédiatement. | 8 | **Could** | ⛔ À planifier (Phase 2) |
| US-7.3 | En tant qu'**équipe**, je veux un **port `IPaymentService` + adaptateurs** (manuel/VoPay/Paysafe) sélectionnés par config et des **webhooks signés idempotents** afin d'encaisser de façon asynchrone et fiable. | 13 | **Could** | ⛔ À planifier (Phase 2) |

### EPIC 8 — Gestion des employés & paie (informative)

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-8.1 | En tant qu'**admin**, je veux **suivre les heures travaillées par employé** et leur **statut de paie** (à payer / payée) afin d'avoir une vue claire de la masse salariale. | 8 | **Could** | 🔵 **Livré — PR #55 ouverte (2026-06-22)** · branche `feat/epic-8-paie` · revue APPROVE WITH NITS |
| US-8.2 | En tant qu'**admin**, je veux optionnellement **verser la paie** en réutilisant les rails de paiement (payout EPIC 7) afin d'automatiser le versement (mode démo). | 5 | **Won't (now)** | ⛔ À planifier (dépend EPIC 7 ; aucun calcul fiscal) |

### EPIC 9 — Catalogue par dimensions configurables

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-9.1 | En tant que **visiteur**, je veux, **après avoir choisi une catégorie d'abri, choisir les dimensions** (largeur fixe par catégorie, longueur configurable par pas de 4 pi, hauteur dégagée) afin de sélectionner le modèle exact. | 13 | **Should** | ✅ **Fait (2026-06-19)** — 9.1 entité+prix · 9.2 API · 9.3 configurateur front · 9.4 panier/commande (`shelterLines` recalculés serveur) · e2e/IT/unit verts |
| US-9.2 | En tant qu'**admin**, je veux **saisir le référentiel dimensionnel** (largeurs/hauteurs/longueurs possibles par catégorie) afin que la sélection client soit exacte. | 5 | **Should** | ✅ **Fait (2026-06-19)** — 9.5 admin CRUD ShelterModel : Create/Update/Delete (`[Authorize(Policy="AdminOnly")]`), page admin avec formulaire modal, correctif CategoryId, 58 ids i18n, 5 e2e axe dual-thème, 16 IT sécurité |

### EPIC 10 — Suggestion d'abris intelligente (mesure & véhicule)

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-10.1 | En tant que **visiteur**, je veux que la mesure de mon entrée propose **toutes les catégories qui rentrent** (pas les dimensions exactes), puis me laisse choisir modèle + longueur (≤ longueur mesurée, max 40 pi), afin de trouver le bon abri sans erreur. | 5 | **Should** | ✅ **Fait (2026-06-21)** — suggestion interrogeant le catalogue `ShelterModel` par empreinte mesurée ; catégories filtrées sur largeur ≤ W + longueurs ≤ L plafonnées 40 pi ; deep-link vers le configurateur ; ancien mécanisme `suggest-shelters` basé `Product` retiré ; e2e `/shelters/suggest` dual-thème axe 0 |
| US-10.2 | En tant que **visiteur**, je veux, lors de la **sélection de véhicules**, indiquer s'ils sont **côte à côte ou l'un derrière l'autre** afin que la suggestion calcule la bonne largeur/longueur. | 3 | **Should** | ✅ **Fait (2026-06-21)** — orientation côte à côte (somme des largeurs) vs l'un derrière l'autre (somme des longueurs) ; dégagement 60 cm réutilisé ; noyau `footprint` neutre extrait pour briser le cycle d'import (L-041) |

### EPIC 11 — Calendrier & planification terrain

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-11.1 | En tant qu'**admin/employé**, je veux un **calendrier** (mois/semaine/jour) montrant horaires et rendez-vous, accessible au clavier, afin de visualiser la charge. | 8 | **Could** | ✅ Livré 2026-06-22 (commit local, branche `feat/epic-11-calendrier`) — `/planning` lecture seule agrège les `BookingSlot` existants ; grille APG clavier (L-015) ; Admin+Staff voient tout (filtre installateur reporté) ; APPROVE WITH NITS, L-044 (fuseau) capturée. PR à la clôture de l'épic. |
| US-11.2 | En tant qu'**admin**, je veux **cliquer un jour** pour voir le détail (employés à l'horaire, RDV), **saisir les heures** et **ajouter RDV/employé** via un overlay accessible. | 8 | **Could** | 🟡 **Parties 1 et 2 livrées 2026-06-22** (commits locaux, branche `feat/epic-11-calendrier`) — **P1** : overlay `role="dialog"` détail du jour (focus/Échap/retour-focus APG) ; Admin : formulaire saisie/édition heures par employé ; Staff : lecture seule. Entité `WorkHoursEntry` (regular entity, minutes-from-midnight local, L-044) + migration `20260622052312_AddWorkHoursEntry` (index unique filtré `(EmployeeId,WorkDate)` `HasFilter("[IsDeleted]=0")`, L-045, FK Restrict) ; CQRS `GetDayDetailQuery` (StaffOrAbove) + `UpsertWorkHoursCommand` (AdminOnly) ; `IIdentityService.GetStaffMembersAsync` (DIP) ; `PlanningController` (`GET /api/v1/planning/day` + `PUT /api/v1/planning/work-hours`) ; 17 ids i18n symétriques. Revue APPROVE WITH NITS (1 Minor filtré corrigé, 2 nits). **P2** : sous-formulaire ajout RDV dans le même overlay (contact libre OU client existant via `SearchCustomers` CQRS, attribution `CustomerId` sécurisée L-028, radiogroups APG L-015, focus inconditionnel L-006 corollaire B, 36 ids i18n symétriques) ; zéro migration. Revue APPROVE WITH NITS (1 Minor focus corrigé). **Reste** : optimisation de tournée (US-11.3). |
| US-11.3 | En tant qu'**admin**, je veux que l'app **optimise le trajet du jour** (plus court) à partir des lat/lng des RDV puis **propose les heures** afin de planifier la tournée. | 5 | **Could** | ✅ **Fait (2026-06-22)** — lat/lng stockées sur `BookingSlot` (migration `AddBookingSlotCoordinates`), géocodage Photon keyless via `IPlacesService.GeocodeAsync` ; `RouteOptimizer` maison (nearest-neighbour + Haversine, zéro dépendance) ; `OptimizeRouteCommand` + `POST /planning/optimize` (AdminOnly) réécrit `SlotStart` Pending+Confirmed, anti-collision `SlotRules.Overlaps` ; bouton Admin calendrier + live-region (L-027) + heures fuseau local (L-044) + i18n fr/en symétrique. Revue APPROVE WITH NITS (1 Minor collision + 1 Nit N+1 corrigés) ; **L-046** capturée. Flake e2e `mesurer.spec.ts` L-012 corrigé (race hydratation SSR, `expect(...).toPass()` + barrières réseau). Gates : `dotnet test` 403+119 ✅ · round-trip live LocalDB ✅ · `npm test` 387 ✅ · `npm run e2e` 13/13 (optimize + dual-thème axe + `timezoneId` non-vacueux) ✅ · `build:prod` ✅. **CLÔTURE EPIC 11 — PR #53 (`53dee27`) MERGÉ 2026-06-22, CI verte (Backend 1m8s / Frontend 9m37s / Build & Deploy 1m38s / SonarCloud 28s).** |

### EPIC 12 — Correctifs de contraste formulaires/focus

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-12.1 | En tant qu'**utilisateur à basse vision**, je veux **voir ce que je tape** dans tous les formulaires (au focus, dans les deux thèmes) afin de saisir sans erreur (WCAG 1.4.3 / 1.4.11). | 3 | **Should** | ✅ **Fait** — register/login/reset (partie 1, `--color-surface` ; `e2e/auth-input-contrast.spec.ts`) + balayage des formulaires publics verrouillé en partie 2 (`e2e/form-focus-contrast.spec.ts`, `/location`, deux thèmes). Audit §5.11/§5.12. |
| US-12.2 | En tant qu'**utilisateur**, je veux que les **CTA primaires (boutons-ancres)** restent lisibles **même après visite** afin de toujours voir le libellé (WCAG 1.4.3). | 2 | **Should** | ⛔ À planifier (Phase 2 ; famille **L-023** — vérifier si déjà déployé ; `:visited` invisible à axe) |
| US-12.3 | En tant qu'**utilisateur**, je veux que le **badge « Ajusté serré » (/mesurer)** et l'**onglet de profil actif** soient lisibles en thème sombre afin de tout lire (WCAG 1.4.3). | 2 | **Should** | ✅ **Fait (partie 2)** — Bug-09 badge 1.67:1 → ≈5.05:1 (`--color-warning-solid`) + onglet `.profile-tab.is-active` 2.77:1 → ≈6.5:1 (`--color-red-600`/`--color-on-brand`), au jeton (L-023). Garde `e2e/badge-tab-contrast.spec.ts` (deux thèmes, prouvée en échec). Audit §5.12. |

### EPIC 13 — Refonte du parcours `/mesurer` (ordre + adresse optionnelle)

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-13.1 | En tant que **visiteur**, je veux **commencer par les dimensions de mon entrée** (je les connais / par véhicules / mesurer sur carte) **sans avoir à saisir mon adresse** d'abord, afin d'aller au but. | 5 | **Should** | ✅ Terminé (EPIC 13, 2026-06-21 ; stepper inversé Dimensionner→Conseil, radiogroup APG 3 voies, voie « manuel » promue en `known-dimensions`) |
| US-13.2 | En tant que **visiteur**, je veux que l'**adresse ne soit demandée qu'au moment de mesurer sur carte** (input au-dessus/à gauche ; pré-rempli + carte centrée si connecté, modifiable), afin de ne saisir l'adresse que si utile. | 3 | **Should** | ✅ Terminé (EPIC 13, 2026-06-21 ; composant `map-voie` = adresse + carte sur la même page ; pré-rempli/auto-centré si connecté, modifiable) |
| US-13.3 | En tant que **visiteur**, je veux à la fin une **étape « Conseil »** qui propose les **catégories qui rentrent → modèle → longueur**, afin de choisir le bon abri (regrouper Mesure+Conseil sous un seul terme). | 3 | **Should** | ✅ Terminé (EPIC 13, 2026-06-21 ; `results-step`→`conseil-step`, contrat `/shelters/suggest` inchangé ; regroupement nommé « Trouver mon abri ») |

### EPIC 14 — Carte satellite plus précise

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-14.1 | En tant que **visiteur**, je veux **zoomer plus profond** sur la carte `/mesurer` afin de tracer une mesure précise de mon entrée. | 5 | **Should** | ✅ **Livré (2026-06-21, EPIC 14)** — over-zoom Esri **gratuit** : `maxNativeZoom=19` + `maxZoom=21` sur le tileLayer, zoom localisé relevé à 21 (`tile-provider.const.ts` / `map-measure.ts`). Source HD payante **écartée** (règle budget) |
| US-14.2 | En tant que **visiteur**, je veux que la **largeur/longueur mesurée soit exacte même si mon entrée n'est pas alignée nord-sud**, afin de ne pas me faire proposer un abri trop grand (et plus cher). | 3 | **Should** | ✅ **Livré (2026-06-21, EPIC 14)** — corrige **L-034** : `measure-rect.util` mesure **par arête** (haversine pure, hand-roll, pas de `@turf/distance`), apparie côtés opposés ; repli `turf.bbox` pour polygone libre. Test rectangle pivoté 45° non-vacueux (prouve le rejet du gonflement bbox ~6,4×6,4) |

### EPIC 15 — Champ d'adresse : spike best-practices puis refonte

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-15.1 | En tant qu'**équipe**, je veux un **spike** comparant un seul champ d'adresse vs champs séparés, lecture seule vs éditable (best-practices Google/GOV.UK + a11y), afin de **recommander** l'approche. | 2 | **Should** | ✅ **LIVRÉ 2026-06-18** (`docs/spikes/epic-15-address-field-spike.md`) — **décision : champ unique « n°+rue » + auto-rempli ÉDITABLE** (lecture seule écartée ; un mauvais CP doit rester corrigeable). |
| US-15.2 | En tant que **client**, je veux **un seul champ d'adresse** (n° civique + rue) avec province/pays/**code postal** auto-remplis **(éditables, pas lecture seule — voir spike)** et le **code postal affiché après sélection** pour confirmer, afin que l'autocomplétion fonctionne et que l'adresse soit fiable. | 5 | **Should** | ⛔ À planifier (Phase 2 ; corrige autocomplete cassée + mauvais code postal ; touche tous les formulaires ; voie serveur B1 recommandée — DTO découpé, split à la présentation) |
| US-15.3 | En tant que **client**, je veux que **modifier le n° civique mette à jour la rue/le code postal** (cohérence) afin d'éviter une adresse incohérente. | 1 | **Should** | ⛔ À planifier (Phase 2 ; bug constaté) |

### EPIC 16 — Documentation d'architecture vivante + briques manquantes

| ID | User Story | Estimation | MoSCoW | Statut |
|----|-----------|:----------:|:------:|--------|
| US-16.1 | En tant qu'**équipe**, je veux un **diagramme de design système** (client mobile/tablette/web → couches → BD, annoté par couche) afin de comprendre/communiquer l'architecture. | 2 | **Could** | ✅ **LIVRÉ 2026-06-17** (`docs/architecture/system-design.{md,drawio}`) |
| US-16.2 | En tant qu'**équipe**, je veux un **backlog des briques transverses manquantes** (cache, cookies, rate-limit, secrets Key Vault, observabilité, health checks, WAF) afin de durcir le système progressivement. | 3 | **Could** | 🟡 Identifiées (system-design §4) ; reste à dérouler chaque brique en story |

---

## Récapitulatif de priorisation (MoSCoW)

| Catégorie | Stories | Total points | État |
|-----------|---------|:------------:|------|
| **Must** | US-1.1→1.4, 2.1→2.5, 3.1→3.5, 4.1, 5.4 | ~52 | majoritairement livré |
| **Should** | US-1.5, 1.6, 2.6, 2.7, 3.6, 3.7, 4.2, 4.3, 5.1, 5.2, 6.1 | ~46 | partiellement livré |
| **Could** | US-5.3, 6.2, 6.3 | ~28 | à venir |
| **Won't (now)** | US-6.4 | 8 | reporté |

**Lecture** : le socle **Must** (catalogue, auth/compte, a11y de base, i18n, contraste sombre)
est livré. Le backlog restant se concentre sur la **complétude transactionnelle** (panier,
checkout, réservation) et le **durcissement qualité** (couverture e2e, retrait du legacy auth,
cibles tactiles).
