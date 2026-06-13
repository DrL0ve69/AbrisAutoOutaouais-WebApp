# Évaluation heuristique — AbrisTempo Local

> Méthode : **10 heuristiques de Nielsen-Molich**.
> Évaluateur : Philippe Charron. Échelle de sévérité de Nielsen :
> **0** = pas un problème · **1** = cosmétique · **2** = mineur · **3** = majeur · **4** = catastrophique.
> Chaque constat cite le composant réel et propose une **recommandation actionnable**.

Périmètre : Accueil (`features/home`), Boutique (`features/shop/catalog`, `product-detail`),
Authentification (`features/auth`), Profil (`features/account/profile`), navigation globale
(`shared/layout`).

---

## H1 — Visibilité de l'état du système

**Constats**
- États de chargement explicites : *skeletons* avec `aria-busy="true"` et `aria-label="Chargement…"` (catalogue, home, profil).
- Retour immédiat à l'ajout au panier : toast « *X* a été ajouté au panier » (`catalog.ts` + `ToastService`) et badge compteur dans la navbar (`navbar.html`, `cartLabel()` annonce « Panier, N articles »).
- Boutons en cours de soumission : `aria-busy` + spinner + texte SR-only « Connexion en cours… » (`auth.html`, `login.html`, `profile.html`).
- Filtre actif clairement marqué (`catalog__chip--active` + `aria-pressed`).

**Points faibles**
- La bascule de langue déclenche un **rechargement complet** vers `/en/` (`navbar.ts switchLang`) sans indicateur de transition — l'utilisateur peut croire à un bug. En `ng serve` standard, seul le FR est servi : cliquer EN peut mener à une page non localisée.

**Sévérité : 2 (mineur)**
**Recommandation** : afficher un court état de transition au changement de langue et désactiver/masquer le bouton EN si le build localisé n'est pas disponible. Repositionner le focus après rechargement.

---

## H2 — Correspondance entre le système et le monde réel

**Constats**
- Vocabulaire métier juste et local : « abris d'auto », « Outaouais », « location/mois », provinces canadiennes listées (`profile.html`), format de code postal `A1A 1A1`, devise `CAD` formatée `fr-CA`.
- Icônes conventionnelles (panier, lune/soleil pour le thème, chevron pour le menu).
- Disponibilité exprimée en langage humain : « En stock » / « Épuisé ».

**Points faibles**
- L'icône de marque « ⬡ » (hexagone) est abstraite et ne porte pas de sens « abri ».

**Sévérité : 1 (cosmétique)**
**Recommandation** : remplacer le glyphe par un logo évoquant un abri/toit ; conserver l'`aria-label` « AbrisTempo Local — Accueil » déjà présent.

---

## H3 — Contrôle et liberté de l'utilisateur

**Constats**
- Lien « ← Retour à la boutique » sur le détail produit (`product-detail.html`).
- Carte d'auth *flip* : on bascule librement connexion ⇄ inscription sans perdre le contexte (`auth.ts switchTo`).
- Menus refermables (`closeMenu`, `closeUserMenu`) ; thème réversible et persistant (`ThemeService`).

**Points faibles**
- Le menu déroulant utilisateur et le menu mobile ne se ferment **pas sur `Échap`** ni sur clic à l'extérieur (aucun handler `(document:click)` / `keydown.escape` dans `navbar.ts`). Frustrant au clavier.
- Pas de confirmation avant déconnexion.

**Sévérité : 3 (majeur)**
**Recommandation** : ajouter fermeture sur `Échap` + clic extérieur pour les menus (pattern *disclosure*), et renvoyer le focus au bouton déclencheur à la fermeture.

---

## H4 — Cohérence et standards

**Constats**
- Système de boutons unifié (`.btn--primary/secondary/outline/ghost`, tailles `--sm/--lg/--full`) appliqué partout.
- Patron de champ commun (`.field`, `.field__label`, `.field__error`, `.field__hint`) réutilisé en auth et profil.
- Navigation et footer identiques sur toutes les pages (`shared/layout`).

**Points faibles**
- **Incohérence majeure** : deux pages d'inscription coexistent. `features/auth/auth.ts` (moderne, accessible, i18n, `username`) vs `features/auth/register/register.component.ts` (legacy : `*ngIf`, `CommonModule`, styles inline gradient mauve `#667eea`, libellés « Email » non i18n, sans ARIA d'erreur). Rupture de cohérence visuelle et d'accessibilité.
- Deux écrans de connexion : `login.ts` (champ `email` avec `Validators.email`) vs `auth.ts` (champ « courriel **ou** nom d'utilisateur », sans `Validators.email`). Comportements divergents.

**Sévérité : 3 (majeur)**
**Recommandation** : supprimer les composants legacy `register.component.ts` et `login.ts`/`login.html` au profit du `AuthComponent` unifié ; faire pointer toutes les routes vers `/auth`.

---

## H5 — Prévention des erreurs

**Constats**
- `novalidate` + validation Angular contrôlée, messages affichés sur `touched` (pas de bruit prématuré).
- Indices avant erreur (`field__hint`) : règles de mot de passe, format de code postal, contraintes de nom d'utilisateur.
- Bouton de soumission désactivé pendant le chargement (`[disabled]="loading()"`).
- Validateur de correspondance des mots de passe (`passwordsMatch`).

**Points faibles**
- Le champ courriel d'inscription utilise `Validators.email` (permissif) ; pas de vérification de disponibilité du `username` côté client → erreur découverte seulement à la soumission serveur.
- Aucune confirmation avant actions destructrices futures (suppression de compte, annulation de réservation — non encore présentes).

**Sévérité : 2 (mineur)**
**Recommandation** : validation asynchrone de l'unicité du nom d'utilisateur/courriel (debounce) avec message inline ; prévoir des dialogues de confirmation pour les futures actions irréversibles.

---

## H6 — Reconnaître plutôt que se rappeler

**Constats**
- Filtres par catégorie toujours visibles (chips), pas de syntaxe à mémoriser.
- Adresse de livraison **mémorisée au profil** et pré-remplie (« sera pré-remplie lors de vos commandes », `profile.html`) → réduit la charge mémoire (WCAG 3.3.7).
- `autocomplete` partout → le navigateur propose les valeurs connues.
- Onglets de profil étiquetés (Informations / Adresse / Sécurité).

**Points faibles**
- Pas de fil d'Ariane (*breadcrumb*) sur le détail produit : seul un lien « Retour » indique le contexte.

**Sévérité : 1 (cosmétique)**
**Recommandation** : ajouter un fil d'Ariane « Accueil / Boutique / *Catégorie* / *Produit* » sur la page détail.

---

## H7 — Flexibilité et efficacité d'utilisation

**Constats**
- Accès rapides multiples vers les produits (navbar, footer, chips, CTA hero).
- Skip-link pour les utilisateurs clavier expérimentés (`skip-nav`).
- Connexion par courriel **ou** nom d'utilisateur (flexibilité d'identifiant, WCAG 3.3.8).
- Thème clair/sombre persistant adapté aux préférences.

**Points faibles**
- Pas de **recherche textuelle** ni de tri (prix, popularité) dans le catalogue — seul le filtre par catégorie existe (`catalog.ts`). Au-delà de quelques produits, c'est limitant.
- Pas de raccourcis clavier pour les power users (acceptable pour le grand public).

**Sévérité : 2 (mineur)**
**Recommandation** : ajouter un champ de recherche (`role="search"`, label associé) et un tri ; paginer côté serveur (l'API expose déjà `pageNumber/pageSize/hasNext`).

---

## H8 — Esthétique et design minimaliste

**Constats**
- Hiérarchie visuelle claire (eyebrow → titre → sous-titre dans `section-header`), espacement systématisé via les jetons d'espacement.
- Contenu décoratif correctement masqué aux technologies d'assistance (`aria-hidden` sur formes, icônes, séparateurs).
- Pages sobres, sans surcharge publicitaire.

**Points faibles**
- La home est **longue** : hero + services + pourquoi-nous + vedettes + **catalogue dupliqué** + CTA. Le catalogue apparaît à la fois sur la home (`#catalogue`) et sur `/boutique`, avec un rendu de carte différent.

**Sévérité : 2 (mineur)**
**Recommandation** : ne garder que les produits *vedettes* sur la home et renvoyer au `/boutique` pour le catalogue complet ; réutiliser `ProductCardComponent` partout pour un rendu unique.

---

## H9 — Aider à reconnaître, diagnostiquer et corriger les erreurs

**Constats**
- Messages d'erreur en langage clair, spécifiques et reliés au champ : `role="alert"` + `aria-describedby` (`auth.html`, `login.html`, `profile.html`).
- Erreur globale de formulaire en `role="alert"` avec icône (`auth-alert--error`).
- Page « Produit introuvable » explicite avec issue de secours (`product-detail.html`, `role="alert"` + CTA retour catalogue).
- Erreurs serveur restituées (`err.error?.error ?? err.error?.detail`).

**Points faibles**
- Le message de repli « Identifiants incorrects. » est générique (acceptable pour la sécurité, mais peu guidant).

**Sévérité : 1 (cosmétique)**
**Recommandation** : conserver le message neutre pour la connexion (bonne pratique sécurité) mais offrir un lien direct « Mot de passe oublié ? » dans l'alerte d'échec.

---

## H10 — Aide et documentation

**Constats**
- Indices contextuels intégrés (`field__hint`) qui documentent les règles sans page d'aide séparée.
- Numéro de téléphone d'aide présent de façon cohérente (footer, CTA, page installation) — WCAG 3.2.6.
- Liens « Conditions d'utilisation », « Confidentialité », « Accessibilité » dans le footer.

**Points faibles**
- Les pages `/location` et `/installation` sont des **placeholders « en construction »** (`installation.ts`, `location.ts`) : l'utilisateur qui veut réserver est renvoyé au téléphone, sans documentation sur la démarche.
- La page « Accessibilité » du footer pointe vers une route non encore implémentée.

**Sévérité : 3 (majeur)**
**Recommandation** : court terme, transformer les placeholders en pages informatives (étapes, délais, zone desservie, FAQ) ; publier une déclaration d'accessibilité réelle.

---

## Tableau récapitulatif (trié par sévérité décroissante)

| Heuristique | Constat principal | Sévérité | Reco clé |
|-------------|-------------------|:--------:|----------|
| H3 Contrôle & liberté | Menus non fermables au clavier (`Échap`/clic extérieur) | **3** | Disclosure pattern + retour de focus |
| H4 Cohérence | Composants auth legacy dupliqués (register/login) | **3** | Unifier sur `AuthComponent`, supprimer le legacy |
| H10 Aide & doc | Réservation = pages « en construction » | **3** | Pages informatives + déclaration d'accessibilité |
| H1 Visibilité | Changement de langue = rechargement opaque | 2 | État de transition + garde sur build localisé |
| H5 Prévention erreurs | Unicité username/courriel vérifiée tardivement | 2 | Validation asynchrone debouncée |
| H7 Flexibilité | Pas de recherche/tri au catalogue | 2 | Recherche `role="search"` + tri + pagination |
| H8 Minimalisme | Home longue + catalogue dupliqué | 2 | Vedettes sur la home, catalogue sur `/boutique` |
| H2 Monde réel | Logo abstrait « ⬡ » | 1 | Logo évoquant un abri |
| H6 Reconnaissance | Pas de fil d'Ariane | 1 | Breadcrumb sur le détail produit |
| H9 Diagnostic erreurs | Message de connexion générique | 1 | Lien « mot de passe oublié » dans l'alerte |

**Lecture d'ensemble** : aucune anomalie catastrophique (4). Trois problèmes **majeurs (3)**
concentrent l'effort de remédiation prioritaire — tous **corrigeables sans refonte** : ils
relèvent du nettoyage de dette (auth legacy), d'un patron d'interaction standard (menus) et de
contenu (pages réservation). La base UX est saine grâce au système de design tokenisé et aux
patrons de champ/bouton réutilisés.

---

## Remédiations livrées (2026-06-11)

| Heuristique | Constat | Sév. | Correctif livré |
|-------------|---------|:----:|-----------------|
| H3 Contrôle & liberté | Menus non fermables au clavier | 3 | ✅ `Échap` + clic extérieur + renvoi de focus au déclencheur (`navbar.ts`) |
| H4 Cohérence | Auth legacy dupliquée | 3 | ✅ `login/` + `register/` supprimés ; routes → `AuthComponent` |
| H10 Aide & doc | Réservation « en construction » | 3 | ✅ **Obsolète** : `/installation` et `/location` sont devenus de vrais formulaires |
| H7 Flexibilité | Pas de recherche/tri | 2 | ✅ Recherche `role="search"` + tri (prix/nom/dispo) + comptage `role="status"` |
| H8 Minimalisme | Home + catalogue dupliqué | 2 | ✅ Section catalogue retirée de la home (vedettes + renvoi `/boutique`) |
| H6 Reconnaissance | Pas de fil d'Ariane | 1 | ✅ Breadcrumb sur le détail produit |
| H9 Diagnostic erreurs | Pas de « mot de passe oublié » utile | 1 | ✅ Page `/auth/reset` accessible (le lien existait sans cible) |
| H2 Monde réel | Logo abstrait « ⬡ » | 1 | ✅ Glyphe d'abri (toit + poteaux) en navbar et auth |

## Remédiations livrées (2026-06-13) — Épic B (sections manquantes)

| Heuristique | Constat | Sév. | Correctif livré |
|-------------|---------|:----:|-----------------|
| H1 Visibilité | Changement de langue = rechargement opaque | 2 | ✅ Marqueur `sessionStorage` avant rechargement + annonce `role="status"` polite à la locale servie (`locale.service.ts`, `app.ts`) — SSR-safe |
| H5 Prévention erreurs | Unicité username/courriel vérifiée tardivement (au submit) | 2 | ✅ Validateurs **asynchrones debouncés** (400 ms, `switchMap`) sur l'inscription → `GET api/v1/auth/availability` ; annonce `aria-busy`/`aria-live` |
| H10 Aide & doc | Réservation sans aide contextuelle | 3 | ✅ **FAQ accessible** (`<details>/<summary>`) sur `/installation` et `/location` (incl. « autres marques sauf ShelterLogic ») |

**Tous les constats heuristiques (H1–H10) sont désormais remédiés.**
Vérification : `dotnet test` (UT 106 / IT 59) ✅, `npm test` 100 (zéro violation axe) ✅, `npm run e2e` 48 ✅.
