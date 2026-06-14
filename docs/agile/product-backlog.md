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
| US-1.7 | En tant que **visiteur**, je veux **mesurer mon stationnement** (carte satellite à dessiner **ou** calculateur de véhicules au clavier) afin que l'app me **suggère un abri qui rentre** et que je choisisse la bonne taille sans erreur. | 13 | **Should** | ✅ Livré (Épic D : dimensions produit `WidthCm/LengthCm/HeightCm` (D1), endpoint `GET /products/suggest-shelters` (D2), feature `/mesurer` stepper Adresse→Mesure→Résultats (D3) — **cm-canonique + affichage en pieds**, radiogroups **APG** (roving tabindex + flèches, L-015), Leaflet+geoman+turf chargés en `@defer`/SSR-safe, badge « Ajusté serré »). **Correctif F2-D (2026-06-14)** : le **mode carte** était en fait **non dessinable** (geoman `map.pm` non attaché) ; rendu fonctionnel par `globalThis.L = L` + import geoman avant `L.map(...)` (L-021), garde e2e de capacité désormais active. |

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
